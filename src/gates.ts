import type { Acceptance, ApprovalRecord, ContractKind, PublishGate } from './generated/contracts.js';
import { ProtocolException, protocolError } from './errors.js';
import { createContractId, formatUtc } from './id.js';
import { assessPolicy, type Clock, type RiskFactors } from './policy.js';
import { safeParseContract } from './validation-v2.js';

export interface GateOptions {
  clock?: Clock;
  idGenerator?: (kind: ContractKind, at: Date) => string;
  riskFactors?: RiskFactors;
}

function clockDate(clock?: Clock): Date {
  const value = clock ? clock() : new Date();
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid clock value');
  return date;
}

function reject(message: string, code: string, path = '/'): never {
  throw new ProtocolException(message, [protocolError(code, path, message, 'semantic')]);
}

function requireGate(input: unknown): PublishGate {
  const result = safeParseContract(input);
  if (!result.success || result.data.kind !== 'PublishGate') {
    throw new ProtocolException('Invalid PublishGate', result.success ? [] : result.errors);
  }
  return result.data;
}

export function createPublishGate(
  acceptanceInput: unknown,
  capabilities: readonly string[],
  options: GateOptions = {},
): PublishGate {
  const acceptanceResult = safeParseContract(acceptanceInput);
  if (!acceptanceResult.success || acceptanceResult.data.kind !== 'Acceptance') {
    throw new ProtocolException('Acceptance schema or semantic validation failed', acceptanceResult.success ? [] : acceptanceResult.errors);
  }
  const acceptance = acceptanceResult.data as Acceptance;
  if (acceptance.status !== 'passed') {
    reject('Only a passed Acceptance can create a PublishGate', 'ACCEPTANCE_NOT_PASSED', '/status');
  }
  const clock = clockDate(options.clock);
  const timestamp = formatUtc(clock);
  const assessment = assessPolicy(capabilities, options.riskFactors, { clock: () => clock });
  const id = options.idGenerator ? options.idGenerator('PublishGate', clock) : createContractId('PublishGate', { now: clock });
  const gate: PublishGate = {
    schemaVersion: '2.0.0',
    id,
    kind: 'PublishGate',
    lifecycle: assessment.autoApproved ? 'final' : 'active',
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    acceptanceId: acceptance.id,
    operation: 'publish',
    riskLevel: assessment.riskLevel,
    requiredApprovals: assessment.requiredApprovals,
    approvals: assessment.autoApproved
      ? [{ role: 'policy_engine', actorId: 'policy-engine', decision: 'approved', decidedAt: timestamp }]
      : [],
    decision: assessment.autoApproved ? 'approved' : 'pending',
  };
  if (assessment.approvalDeadline) gate.approvalDeadline = assessment.approvalDeadline;
  const validation = safeParseContract(gate);
  if (!validation.success) throw new ProtocolException('Generated PublishGate failed validation', validation.errors);
  return validation.data as PublishGate;
}

export interface ApprovalInput {
  role: ApprovalRecord['role'];
  actorId: string;
  decision: ApprovalRecord['decision'];
  decidedAt?: string;
  reason?: string;
}

export function applyApproval(gateInput: unknown, input: ApprovalInput, options: { clock?: Clock } = {}): PublishGate {
  const gate = requireGate(gateInput);
  if (gate.decision !== 'pending' || gate.lifecycle !== 'active') reject('Only a pending active gate accepts approvals', 'GATE_NOT_PENDING', '/decision');
  if (!gate.requiredApprovals.includes(input.role as never)) reject('Approval role was not requested', 'UNREQUESTED_APPROVAL_ROLE', '/role');
  if (gate.approvals.some((approval) => approval.role === input.role)) reject('A role cannot be decided twice', 'DUPLICATE_APPROVAL_ROLE', '/role');
  const now = clockDate(options.clock);
  if (gate.approvalDeadline && now.getTime() > new Date(gate.approvalDeadline).getTime()) reject('Approval deadline has expired', 'APPROVAL_AFTER_DEADLINE', '/approvalDeadline');
  const decidedAt = input.decidedAt ?? formatUtc(now);
  if (new Date(decidedAt).getTime() > now.getTime()) reject('Approval time cannot be in the future', 'APPROVAL_TIME_INVALID', '/decidedAt');
  const approval: ApprovalRecord = { role: input.role, actorId: input.actorId, decision: input.decision, decidedAt };
  if (input.reason !== undefined) approval.reason = input.reason;
  const approvals = [...gate.approvals, approval];
  const rejected = approval.decision === 'rejected';
  const approvedRoles = new Set(approvals.filter((item) => item.decision === 'approved').map((item) => item.role));
  const complete = gate.requiredApprovals.every((role) => approvedRoles.has(role));
  const decision = rejected ? 'rejected' : complete ? 'approved' : 'pending';
  const next: PublishGate = {
    ...gate,
    approvals,
    decision,
    lifecycle: decision === 'pending' ? 'active' : 'final',
    revision: gate.revision + 1,
    updatedAt: formatUtc(now),
  };
  const validation = safeParseContract(next);
  if (!validation.success) throw new ProtocolException('Updated PublishGate failed validation', validation.errors);
  return validation.data as PublishGate;
}

export function expireGate(gateInput: unknown, options: { clock?: Clock } = {}): PublishGate {
  const gate = requireGate(gateInput);
  if (gate.decision !== 'pending' || gate.lifecycle !== 'active') reject('Only a pending active gate can expire', 'GATE_NOT_PENDING', '/decision');
  if (!gate.approvalDeadline) reject('Pending gate has no deadline', 'APPROVAL_DEADLINE_REQUIRED', '/approvalDeadline');
  const now = clockDate(options.clock);
  if (now.getTime() <= new Date(gate.approvalDeadline).getTime()) reject('Approval deadline has not elapsed', 'DEADLINE_NOT_REACHED', '/approvalDeadline');
  const next: PublishGate = { ...gate, decision: 'expired', lifecycle: 'frozen', revision: gate.revision + 1, updatedAt: formatUtc(now) };
  const validation = safeParseContract(next);
  if (!validation.success) throw new ProtocolException('Expired PublishGate failed validation', validation.errors);
  return validation.data as PublishGate;
}
