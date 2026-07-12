import type { Contract, ContractKind, Evidence, PublishGate } from './generated/contracts.js';
import { getSchemaRegistry } from './schema-registry.js';
import { protocolError } from './errors.js';
import type { ProtocolError, SafeResult } from './validation-types.js';

const KINDS: ContractKind[] = ['IntentContract', 'TaskSeed', 'Acceptance', 'PublishGate', 'Evidence'];

function isKind(value: unknown): value is ContractKind {
  return typeof value === 'string' && KINDS.includes(value as ContractKind);
}

type AjvError = { keyword: string; params?: unknown; instancePath?: string; message?: string };

function ajvErrors(errors: unknown[] | null | undefined): ProtocolError[] {
  return (errors ?? []).map((raw) => {
    const error = raw as AjvError;
    const suffix = error.keyword === 'required' && typeof error.params === 'object' && error.params && 'missingProperty' in error.params
      ? '/' + String((error.params as { missingProperty: string }).missingProperty)
      : '';
    return protocolError('SCHEMA_' + error.keyword.toUpperCase(), (error.instancePath || '') + suffix || '/', error.message ?? 'Schema validation failed', 'schema');
  });
}

function semanticError(code: string, path: string, message: string): ProtocolError {
  return protocolError(code, path, message, 'semantic');
}


export function validateContractSemantics(contract: Contract): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (contract.kind === 'PublishGate') {
    const gate = contract as PublishGate;
    const requiredByRisk: Record<string, string[]> = {
      low: [], medium: [], high: ['project_lead', 'security_reviewer'],
      critical: ['project_lead', 'security_reviewer', 'release_manager'],
    };
    if (JSON.stringify(gate.requiredApprovals) !== JSON.stringify(requiredByRisk[gate.riskLevel])) {
      errors.push(semanticError('POLICY_APPROVAL_MISMATCH', '/requiredApprovals', 'requiredApprovals must exactly match risk policy'));
    }
    const roles = new Set<string>();
    for (const approval of gate.approvals) {
      if (roles.has(approval.role)) errors.push(semanticError('DUPLICATE_APPROVAL_ROLE', '/approvals', 'A role may be decided only once'));
      roles.add(approval.role);
      if (approval.role !== 'policy_engine' && !gate.requiredApprovals.includes(approval.role as never)) {
        errors.push(semanticError('UNREQUESTED_APPROVAL_ROLE', '/approvals', 'Approval role was not requested'));
      }
    }
    if (gate.riskLevel !== 'low' && gate.riskLevel !== 'medium' && !gate.approvalDeadline) {
      errors.push(semanticError('APPROVAL_DEADLINE_REQUIRED', '/approvalDeadline', 'High and critical gates require an approval deadline'));
    }
    if ((gate.riskLevel === 'low' || gate.riskLevel === 'medium') && gate.decision === 'pending') {
      errors.push(semanticError('AUTO_APPROVAL_REQUIRED', '/decision', 'Low and medium gates must be immediately approved'));
    }
    if ((gate.riskLevel === 'low' || gate.riskLevel === 'medium') && gate.decision === 'approved' &&
        !gate.approvals.some((approval) => approval.role === 'policy_engine' && approval.decision === 'approved')) {
      errors.push(semanticError('POLICY_ENGINE_APPROVAL_REQUIRED', '/approvals', 'Auto-approved gates require a policy_engine approval'));
    }
    if (gate.decision === 'pending' && gate.lifecycle !== 'active') {
      errors.push(semanticError('GATE_LIFECYCLE_MISMATCH', '/lifecycle', 'Pending gates must be active'));
    }
    if ((gate.decision === 'approved' || gate.decision === 'rejected') && gate.lifecycle !== 'final') {
      errors.push(semanticError('GATE_LIFECYCLE_MISMATCH', '/lifecycle', 'Approved and rejected gates must be final'));
    }
    if (gate.decision === 'expired' && gate.lifecycle !== 'frozen') {
      errors.push(semanticError('GATE_LIFECYCLE_MISMATCH', '/lifecycle', 'Expired gates must be frozen'));
    }
    const approvedRoles = new Set(gate.approvals.filter((approval) => approval.decision === 'approved').map((approval) => approval.role));
    const rejectedRoles = gate.approvals.filter((approval) => approval.decision === 'rejected');
    if (gate.decision === 'approved' && gate.requiredApprovals.some((role) => !approvedRoles.has(role))) {
      errors.push(semanticError('MISSING_APPROVAL', '/approvals', 'Approved gates must contain every required approval'));
    }
    if (gate.decision === 'approved' && rejectedRoles.length > 0) {
      errors.push(semanticError('CONFLICTING_APPROVAL', '/approvals', 'An approved gate cannot contain a rejection'));
    }
    if (gate.decision === 'rejected' && rejectedRoles.length === 0) {
      errors.push(semanticError('REJECTION_RECORD_REQUIRED', '/approvals', 'Rejected gates require a rejection record'));
    }
    if (gate.decision === 'pending' && gate.approvals.some((approval) => approval.decision === 'rejected')) {
      errors.push(semanticError('GATE_DECISION_MISMATCH', '/decision', 'A rejected approval cannot remain pending'));
    }
  }
  if (contract.kind === 'Evidence') {
    const evidence = contract as Evidence;
    if (new Date(evidence.startTime).getTime() > new Date(evidence.endTime).getTime()) {
      errors.push(semanticError('EVIDENCE_TIME_ORDER', '/startTime', 'startTime must not be after endTime'));
    }
    if (evidence.createdAt !== evidence.updatedAt) {
      errors.push(semanticError('EVIDENCE_IMMUTABLE_TIMESTAMP', '/updatedAt', 'Evidence createdAt and updatedAt must be identical'));
    }
    if (evidence.policyVerdict === 'manual_review_required' && !evidence.approvalsSnapshot) {
      errors.push(semanticError('EVIDENCE_APPROVAL_SNAPSHOT_REQUIRED', '/approvalsSnapshot', 'Manual review Evidence requires approvalsSnapshot'));
    }
    if (evidence.stage === 'publish' && (!evidence.acceptanceId || !evidence.publishGateId)) {
      errors.push(semanticError('EVIDENCE_PUBLISH_REFERENCES_REQUIRED', '/', 'Publish Evidence requires acceptanceId and publishGateId'));
    }
  }
  return errors;
}

export function safeParseContract(input: unknown): SafeResult<Contract> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, errors: [protocolError('SCHEMA_TYPE', '/', 'Contract must be an object', 'schema')] };
  }
  const kind = (input as { kind?: unknown }).kind;
  if (!isKind(kind)) {
    return { success: false, errors: [protocolError('UNKNOWN_KIND', '/kind', 'Unknown contract kind; validation is fail-closed', 'schema')] };
  }
  const validator = getSchemaRegistry().contracts.get(kind)!;
  if (!validator(input)) return { success: false, errors: ajvErrors(validator.errors) };
  const contract = input as Contract;
  const errors = validateContractSemantics(contract);
  return errors.length > 0 ? { success: false, errors } : { success: true, data: contract };
}

export function parseContract(input: unknown): Contract {
  const result = safeParseContract(input);
  if (!result.success) throw new Error(result.errors.map((error) => error.code + ' ' + error.path + ': ' + error.message).join('; '));
  return result.data;
}

export function safeParseEvent(input: unknown): SafeResult<import('./generated/contracts.js').CloudEvent> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, errors: [protocolError('SCHEMA_TYPE', '/', 'CloudEvent must be an object', 'schema')] };
  }
  const registry = getSchemaRegistry();
  if (!registry.event(input)) return { success: false, errors: ajvErrors(registry.event.errors) };
  const event = input as import('./generated/contracts.js').CloudEvent;
  const errors: ProtocolError[] = [];
  const contractResult = safeParseContract(event.data);
  if (!contractResult.success) {
    errors.push(...contractResult.errors.map((error) => ({ ...error, path: '/data' + (error.path === '/' ? '' : error.path) })));
  } else {
    if (event.subject !== contractResult.data.id) errors.push(protocolError('EVENT_SUBJECT_MISMATCH', '/subject', 'subject must equal data.id', 'semantic'));
    if (event.contractrevision !== contractResult.data.revision) errors.push(protocolError('EVENT_REVISION_MISMATCH', '/contractrevision', 'contractrevision must equal data.revision', 'semantic'));
  }
  return errors.length > 0 ? { success: false, errors } : { success: true, data: event };
}

export function parseEvent(input: unknown): import('./generated/contracts.js').CloudEvent {
  const result = safeParseEvent(input);
  if (!result.success) throw new Error(result.errors.map((error) => error.code + ' ' + error.path + ': ' + error.message).join('; '));
  return result.data;
}
