/* Generated from schemas/v2 by scripts/generate-types.mjs. Do not edit manually. */
export type ContractKind = 'IntentContract' | 'TaskSeed' | 'Acceptance' | 'PublishGate' | 'Evidence';
export type Lifecycle = 'draft' | 'active' | 'frozen' | 'final' | 'superseded' | 'revoked' | 'archived';
export type Capability = 'read_repo' | 'write_repo' | 'install_deps' | 'network_access' | 'read_secrets' | 'publish_release';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = Priority;
export type ApprovalRole = 'project_lead' | 'security_reviewer' | 'release_manager' | 'policy_engine' | 'admin';
export type ExecutionRole = 'developer' | 'ci_agent' | 'qa' | 'project_lead' | 'release_manager' | 'admin';
export type AcceptanceStatus = 'pending' | 'passed' | 'failed' | 'blocked';
export type ApprovalDecision = 'approved' | 'rejected';
export type GateDecision = 'pending' | 'approved' | 'rejected' | 'expired';
export type EvidenceStage = 'plan' | 'execution' | 'acceptance' | 'publish' | 'integration';
export type PolicyVerdict = 'approved' | 'rejected' | 'manual_review_required';

export interface BaseContract {
  schemaVersion: '2.0.0';
  id: string;
  kind: ContractKind;
  lifecycle: Lifecycle;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationPolicy {
  auto_activate: boolean;
  requiredActivationApprovals: Exclude<ApprovalRole, 'policy_engine'>[];
}

export interface IntentContract extends BaseContract {
  kind: 'IntentContract';
  intent: string;
  creator: string;
  priority: Priority;
  requestedCapabilities: Capability[];
}

export interface TaskSeed extends BaseContract {
  kind: 'TaskSeed';
  intentId: string;
  description: string;
  ownerRole: ExecutionRole;
  executionPlan: string[];
  requestedCapabilitiesSnapshot: Capability[];
  generationPolicy: GenerationPolicy;
}

export interface Acceptance extends BaseContract {
  kind: 'Acceptance';
  taskSeedId: string;
  status: AcceptanceStatus;
  details: string;
  criteria: string[];
  generationPolicy: GenerationPolicy;
}

export interface ApprovalRecord {
  role: ApprovalRole;
  actorId: string;
  decision: ApprovalDecision;
  decidedAt: string;
  reason?: string;
}

export interface PublishGate extends BaseContract {
  kind: 'PublishGate';
  acceptanceId: string;
  operation: 'publish';
  riskLevel: RiskLevel;
  requiredApprovals: Exclude<ApprovalRole, 'policy_engine' | 'admin'>[];
  approvals: ApprovalRecord[];
  decision: GateDecision;
  approvalDeadline?: string;
}

export interface HashReference {
  algorithm: string;
  value: string;
}

export interface ToolReference {
  name: string;
  version?: string;
  digest?: HashReference;
}

export interface Evidence extends BaseContract {
  kind: 'Evidence';
  lifecycle: 'final';
  revision: 1;
  stage: EvidenceStage;
  taskSeedId: string;
  acceptanceId?: string;
  publishGateId?: string;
  baseCommit: HashReference;
  headCommit: HashReference;
  inputHash: HashReference;
  outputHash: HashReference;
  model: { name: string; version: string; parametersHash: HashReference };
  tools: ToolReference[];
  environment: {
    os: string;
    runtime: string;
    containerImageDigest: HashReference;
    lockfileHash: HashReference;
  };
  staleStatus: { classification: 'fresh' | 'soft_stale' | 'hard_stale'; evaluatedAt: string; reason?: string };
  mergeResult: {
    status: 'not_applicable' | 'not_attempted' | 'merged' | 'manual_resolution_required';
    mergedAt?: string;
    strategy?: string;
    reason?: string;
  };
  startTime: string;
  endTime: string;
  actor: string;
  approvalsSnapshot?: ApprovalRecord[];
  policyVerdict: PolicyVerdict;
  diffHash: HashReference;
}

export type Contract = IntentContract | TaskSeed | Acceptance | PublishGate | Evidence;

export interface CloudEvent<T = Contract> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject: string;
  time: string;
  datacontenttype?: 'application/json';
  data: T;
  correlationid: string;
  causationid: string;
  idempotencykey: string;
  contractrevision: number;
}
