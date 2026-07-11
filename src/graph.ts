import type { Contract, ContractKind, Evidence, PublishGate } from './generated/contracts.js';
import { protocolError } from './errors.js';
import { safeParseContract } from './validation-v2.js';
import type { ProtocolError, ValidationSummary } from './validation-types.js';

function summary(errors: ProtocolError[]): ValidationSummary {
  return { valid: errors.length === 0, success: errors.length === 0, errors };
}

const allowed: Record<Exclude<ContractKind, 'Evidence'>, Record<string, string[]>> = {
  IntentContract: {
    draft: ['active', 'frozen', 'revoked', 'archived'], active: ['frozen', 'final', 'revoked'],
    frozen: ['active', 'final', 'revoked', 'archived'], final: ['superseded', 'revoked', 'archived'],
    superseded: ['archived'], revoked: ['archived'], archived: [],
  },
  TaskSeed: {
    draft: ['active', 'frozen', 'revoked', 'archived'], active: ['frozen', 'final', 'revoked'],
    frozen: ['active', 'final', 'revoked', 'archived'], final: ['superseded', 'revoked', 'archived'],
    superseded: ['archived'], revoked: ['archived'], archived: [],
  },
  Acceptance: {
    draft: ['active', 'frozen', 'revoked', 'archived'], active: ['frozen', 'final', 'revoked'],
    frozen: ['active', 'final', 'revoked', 'archived'], final: ['superseded', 'revoked', 'archived'],
    superseded: ['archived'], revoked: ['archived'], archived: [],
  },
  PublishGate: {
    active: ['final', 'frozen', 'revoked'], frozen: ['active', 'final', 'revoked', 'archived'],
    final: ['archived', 'revoked'], revoked: ['archived'], archived: [],
  },
};

function refFields(contract: Contract): string[] {
  switch (contract.kind) {
    case 'TaskSeed': return ['intentId'];
    case 'Acceptance': return ['taskSeedId'];
    case 'PublishGate': return ['acceptanceId'];
    case 'Evidence': return ['taskSeedId', 'acceptanceId', 'publishGateId'];
    default: return [];
  }
}

export function validateTransition(previousInput: unknown, nextInput: unknown): ValidationSummary {
  const errors: ProtocolError[] = [];
  const previousResult = safeParseContract(previousInput);
  const nextResult = safeParseContract(nextInput);
  if (!previousResult.success) errors.push(...previousResult.errors);
  if (!nextResult.success) errors.push(...nextResult.errors);
  if (!previousResult.success || !nextResult.success) return summary(errors);
  const previous = previousResult.data;
  const next = nextResult.data;
  if (previous.kind !== next.kind || previous.id !== next.id) {
    errors.push(protocolError('TRANSITION_IDENTITY', '/', 'A transition must keep kind and id unchanged', 'semantic'));
    return summary(errors);
  }
  if (previous.kind === 'Evidence') {
    errors.push(protocolError('EVIDENCE_IMMUTABLE', '/', 'Evidence cannot be updated', 'semantic'));
    return summary(errors);
  }
  if (next.revision !== previous.revision + 1) errors.push(protocolError('REVISION_MISMATCH', '/revision', 'revision must increase by exactly one', 'semantic'));
  if (next.createdAt !== previous.createdAt) errors.push(protocolError('CREATED_AT_IMMUTABLE', '/createdAt', 'createdAt cannot change', 'semantic'));
  if (new Date(next.updatedAt).getTime() < new Date(previous.updatedAt).getTime()) errors.push(protocolError('UPDATED_AT_ORDER', '/updatedAt', 'updatedAt cannot move backwards', 'semantic'));
  if (previous.lifecycle !== next.lifecycle) {
    const nextStates = allowed[previous.kind][previous.lifecycle] ?? [];
    if (!nextStates.includes(next.lifecycle)) errors.push(protocolError('ILLEGAL_TRANSITION', '/lifecycle', 'Lifecycle transition is not allowed for this kind', 'semantic'));
  }
  if (next.kind === 'PublishGate') {
    const gate = next as PublishGate;
    if (gate.decision === 'pending' && gate.lifecycle !== 'active') errors.push(protocolError('GATE_LIFECYCLE_MISMATCH', '/lifecycle', 'Pending gates must be active', 'semantic'));
    if ((gate.decision === 'approved' || gate.decision === 'rejected') && gate.lifecycle !== 'final') errors.push(protocolError('GATE_LIFECYCLE_MISMATCH', '/lifecycle', 'Decided gates must be final', 'semantic'));
    if (gate.decision === 'expired' && gate.lifecycle !== 'frozen') errors.push(protocolError('GATE_LIFECYCLE_MISMATCH', '/lifecycle', 'Expired gates must be frozen', 'semantic'));
  }
  for (const field of refFields(previous)) {
    if ((previous as unknown as Record<string, unknown>)[field] !== (next as unknown as Record<string, unknown>)[field]) {
      errors.push(protocolError('REFERENCE_IMMUTABLE', '/' + field, 'Contract references cannot change during a transition', 'reference'));
    }
  }
  return summary(errors);
}

export function validateContractGraph(inputs: Iterable<unknown>): ValidationSummary {
  const errors: ProtocolError[] = [];
  const contracts: Contract[] = [];
  for (const input of inputs) {
    const result = safeParseContract(input);
    if (!result.success) errors.push(...result.errors);
    else contracts.push(result.data);
  }
  const byId = new Map(contracts.map((contract) => [contract.id, contract]));
  for (const contract of contracts) {
    if (contract.kind === 'TaskSeed') {
      const target = byId.get(contract.intentId);
      if (!target) errors.push(protocolError('REFERENCE_NOT_FOUND', '/intentId', 'Referenced IntentContract was not found', 'reference'));
      else if (target.kind !== 'IntentContract') errors.push(protocolError('REFERENCE_KIND_MISMATCH', '/intentId', 'intentId must reference IntentContract', 'reference'));
      else if (JSON.stringify(target.requestedCapabilities) !== JSON.stringify(contract.requestedCapabilitiesSnapshot)) {
        errors.push(protocolError('CAPABILITY_SNAPSHOT_MISMATCH', '/requestedCapabilitiesSnapshot', 'TaskSeed capability snapshot must match IntentContract', 'reference'));
      }
    }
    if (contract.kind === 'Acceptance') {
      const target = byId.get(contract.taskSeedId);
      if (!target) errors.push(protocolError('REFERENCE_NOT_FOUND', '/taskSeedId', 'Referenced TaskSeed was not found', 'reference'));
      else if (target.kind !== 'TaskSeed') errors.push(protocolError('REFERENCE_KIND_MISMATCH', '/taskSeedId', 'taskSeedId must reference TaskSeed', 'reference'));
    }
    if (contract.kind === 'PublishGate') {
      const target = byId.get(contract.acceptanceId);
      if (!target) errors.push(protocolError('REFERENCE_NOT_FOUND', '/acceptanceId', 'Referenced Acceptance was not found', 'reference'));
      else if (target.kind !== 'Acceptance') errors.push(protocolError('REFERENCE_KIND_MISMATCH', '/acceptanceId', 'acceptanceId must reference Acceptance', 'reference'));
      else if (target.status !== 'passed') errors.push(protocolError('ACCEPTANCE_NOT_PASSED', '/acceptanceId', 'PublishGate requires a passed Acceptance', 'reference'));
    }
    if (contract.kind === 'Evidence') {
      const evidence = contract as Evidence;
      const task = byId.get(evidence.taskSeedId);
      if (!task) errors.push(protocolError('REFERENCE_NOT_FOUND', '/taskSeedId', 'Referenced TaskSeed was not found', 'reference'));
      else if (task.kind !== 'TaskSeed') errors.push(protocolError('REFERENCE_KIND_MISMATCH', '/taskSeedId', 'taskSeedId must reference TaskSeed', 'reference'));
      if (evidence.stage === 'publish') {
        const acceptance = evidence.acceptanceId ? byId.get(evidence.acceptanceId) : undefined;
        const gate = evidence.publishGateId ? byId.get(evidence.publishGateId) : undefined;
        if (!acceptance || acceptance.kind !== 'Acceptance') errors.push(protocolError('REFERENCE_NOT_FOUND', '/acceptanceId', 'Publish Evidence must reference Acceptance', 'reference'));
        if (!gate || gate.kind !== 'PublishGate') errors.push(protocolError('REFERENCE_NOT_FOUND', '/publishGateId', 'Publish Evidence must reference PublishGate', 'reference'));
        if (acceptance && acceptance.kind === 'Acceptance' && acceptance.taskSeedId !== evidence.taskSeedId) errors.push(protocolError('REFERENCE_CHAIN_MISMATCH', '/acceptanceId', 'Acceptance must reference Evidence.taskSeedId', 'reference'));
        if (gate && gate.kind === 'PublishGate' && gate.acceptanceId !== evidence.acceptanceId) errors.push(protocolError('REFERENCE_CHAIN_MISMATCH', '/publishGateId', 'PublishGate must reference Evidence.acceptanceId', 'reference'));
        if (gate && gate.kind === 'PublishGate' && (gate.riskLevel === 'high' || gate.riskLevel === 'critical') && !evidence.approvalsSnapshot) {
          errors.push(protocolError('APPROVAL_SNAPSHOT_REQUIRED', '/approvalsSnapshot', 'Manual approval PublishGate requires approvalsSnapshot', 'reference'));
        }
        if (gate && gate.kind === 'PublishGate' && evidence.approvalsSnapshot && JSON.stringify(gate.approvals) !== JSON.stringify(evidence.approvalsSnapshot)) {
          errors.push(protocolError('APPROVAL_SNAPSHOT_MISMATCH', '/approvalsSnapshot', 'Evidence approvalsSnapshot must exactly match PublishGate approvals', 'reference'));
        }
      }
    }
  }
  return summary(errors);
}
