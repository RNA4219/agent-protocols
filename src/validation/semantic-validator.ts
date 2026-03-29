/**
 * Semantic Validation for agent-protocols contracts.
 * These validations cover rules that cannot be expressed in JSON Schema.
 */

export type ContractKind = 'IntentContract' | 'TaskSeed' | 'Acceptance' | 'PublishGate' | 'Evidence';

export type ContractState = 'Draft' | 'Active' | 'Frozen' | 'Published' | 'Superseded' | 'Revoked' | 'Archived';

export interface BaseContract {
  schemaVersion: string;
  id: string;
  kind: ContractKind;
  state: ContractState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntentContract extends BaseContract {
  kind: 'IntentContract';
  intent: string;
  creator: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requestedCapabilities: string[];
}

export interface TaskSeed extends BaseContract {
  kind: 'TaskSeed';
  intentId: string;
  description: string;
  ownerRole: string;
  executionPlan: string[];
  requestedCapabilitiesSnapshot: string[];
  generationPolicy: {
    auto_activate: boolean;
    requiredActivationApprovals: string[];
  };
}

export interface Acceptance extends BaseContract {
  kind: 'Acceptance';
  taskSeedId: string;
  status: 'pending' | 'passed' | 'failed' | 'blocked';
  details: string;
  criteria: string[];
  generationPolicy: {
    auto_activate: boolean;
    requiredActivationApprovals: string[];
  };
}

export interface PublishGate extends BaseContract {
  kind: 'PublishGate';
  entityId: string;
  action: 'publish' | 'reject' | 'hold';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredApprovals: string[];
  approvals: Array<{
    role: string;
    actorId: string;
    decision: 'approved' | 'rejected';
    decidedAt: string;
    reason?: string;
  }>;
  finalDecision: 'pending' | 'approved' | 'rejected' | 'expired';
  approvalDeadline?: string;
}

export interface Evidence extends BaseContract {
  kind: 'Evidence';
  taskSeedId: string;
  baseCommit: string;
  headCommit: string;
  inputHash: string;
  outputHash: string;
  model: {
    name: string;
    version: string;
    parametersHash: string;
  };
  tools: string[];
  environment: {
    os: string;
    runtime: string;
    containerImageDigest: string;
    lockfileHash: string;
  };
  staleStatus: {
    classification: 'fresh' | 'soft_stale' | 'hard_stale';
    evaluatedAt: string;
    reason?: string;
  };
  mergeResult: {
    status: 'not_applicable' | 'not_attempted' | 'merged' | 'manual_resolution_required';
    mergedAt?: string;
    strategy?: string;
    reason?: string;
  };
  startTime: string;
  endTime: string;
  actor: string;
  approvalsSnapshot?: Array<{
    role: string;
    actorId: string;
    decision: 'approved' | 'rejected';
    decidedAt: string;
    reason?: string;
  }>;
  policyVerdict: 'approved' | 'rejected' | 'manual_review_required';
  diffHash: string;
}

export type Contract = IntentContract | TaskSeed | Acceptance | PublishGate | Evidence;

export interface ValidationError {
  path: string;
  message: string;
  kind: 'semantic';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Semantic Validator for contract validation.
 */
export class SemanticValidator {
  /**
   * Validate a contract against semantic rules.
   */
  validate(contract: Contract): ValidationResult {
    const errors: ValidationError[] = [];

    switch (contract.kind) {
      case 'IntentContract':
        // No additional semantic rules for IntentContract
        break;
      case 'TaskSeed':
        this.validateTaskSeed(contract as TaskSeed, errors);
        break;
      case 'Acceptance':
        this.validateAcceptance(contract as Acceptance, errors);
        break;
      case 'PublishGate':
        this.validatePublishGate(contract as PublishGate, errors);
        break;
      case 'Evidence':
        this.validateEvidence(contract as Evidence, errors);
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate TaskSeed semantic rules.
   */
  private validateTaskSeed(taskSeed: TaskSeed, errors: ValidationError[]): void {
    // If auto_activate is false, requiredActivationApprovals must have at least 1 item
    if (
      taskSeed.generationPolicy.auto_activate === false &&
      taskSeed.generationPolicy.requiredActivationApprovals.length === 0
    ) {
      errors.push({
        path: 'generationPolicy.requiredActivationApprovals',
        message: 'requiredActivationApprovals must have at least 1 item when auto_activate is false',
        kind: 'semantic',
      });
    }
  }

  /**
   * Validate Acceptance semantic rules.
   */
  private validateAcceptance(acceptance: Acceptance, errors: ValidationError[]): void {
    // If auto_activate is false, requiredActivationApprovals must have at least 1 item
    if (
      acceptance.generationPolicy.auto_activate === false &&
      acceptance.generationPolicy.requiredActivationApprovals.length === 0
    ) {
      errors.push({
        path: 'generationPolicy.requiredActivationApprovals',
        message: 'requiredActivationApprovals must have at least 1 item when auto_activate is false',
        kind: 'semantic',
      });
    }
  }

  /**
   * Validate PublishGate semantic rules.
   */
  private validatePublishGate(publishGate: PublishGate, errors: ValidationError[]): void {
    // If requiredApprovals has items, approvalDeadline is required
    if (
      publishGate.requiredApprovals.length > 0 &&
      !publishGate.approvalDeadline
    ) {
      errors.push({
        path: 'approvalDeadline',
        message: 'approvalDeadline is required when requiredApprovals is not empty',
        kind: 'semantic',
      });
    }

    // If requiredApprovals is empty, finalDecision must not be pending
    if (
      publishGate.requiredApprovals.length === 0 &&
      publishGate.finalDecision === 'pending'
    ) {
      errors.push({
        path: 'finalDecision',
        message: 'finalDecision must be "approved" or "rejected" when requiredApprovals is empty',
        kind: 'semantic',
      });
    }

    // Check that all required approvals have been met before finalDecision is approved
    if (publishGate.finalDecision === 'approved' && publishGate.requiredApprovals.length > 0) {
      const approvedRoles = new Set(
        publishGate.approvals
          .filter((a) => a.decision === 'approved')
          .map((a) => a.role)
      );

      for (const required of publishGate.requiredApprovals) {
        if (!approvedRoles.has(required)) {
          errors.push({
            path: 'approvals',
            message: `Missing required approval from role: ${required}`,
            kind: 'semantic',
          });
        }
      }
    }
  }

  /**
   * Validate Evidence semantic rules.
   */
  private validateEvidence(evidence: Evidence, errors: ValidationError[]): void {
    // startTime must be <= endTime
    const startTime = new Date(evidence.startTime);
    const endTime = new Date(evidence.endTime);

    if (startTime > endTime) {
      errors.push({
        path: 'startTime',
        message: 'startTime must be less than or equal to endTime',
        kind: 'semantic',
      });
    }

    // Evidence must have state = Published
    if (evidence.state !== 'Published') {
      errors.push({
        path: 'state',
        message: 'Evidence must have state "Published"',
        kind: 'semantic',
      });
    }

    // approvalsSnapshot is required when policyVerdict is manual_review_required
    if (
      evidence.policyVerdict === 'manual_review_required' &&
      (!evidence.approvalsSnapshot || evidence.approvalsSnapshot.length === 0)
    ) {
      errors.push({
        path: 'approvalsSnapshot',
        message: 'approvalsSnapshot is required when policyVerdict is "manual_review_required"',
        kind: 'semantic',
      });
    }
  }
}

/**
 * Validate TaskSeed.requestedCapabilitiesSnapshot matches IntentContract.requestedCapabilities.
 */
export function validateCapabilitiesMatch(
  taskSeed: TaskSeed,
  intentContract: IntentContract
): ValidationResult {
  const errors: ValidationError[] = [];

  const requestedSet = new Set(intentContract.requestedCapabilities);
  const snapshotSet = new Set(taskSeed.requestedCapabilitiesSnapshot);

  if (requestedSet.size !== snapshotSet.size) {
    errors.push({
      path: 'requestedCapabilitiesSnapshot',
      message: 'requestedCapabilitiesSnapshot does not match IntentContract.requestedCapabilities',
      kind: 'semantic',
    });
  } else {
    for (const cap of requestedSet) {
      if (!snapshotSet.has(cap)) {
        errors.push({
          path: 'requestedCapabilitiesSnapshot',
          message: `Missing capability in snapshot: ${cap}`,
          kind: 'semantic',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Derive generationPolicy from requestedCapabilities.
 */
export function deriveGenerationPolicy(capabilities: string[]): {
  auto_activate: boolean;
  requiredActivationApprovals: string[];
} {
  const hasInstallDeps = capabilities.includes('install_deps');
  const hasNetworkAccess = capabilities.includes('network_access');
  const hasReadSecrets = capabilities.includes('read_secrets');
  const hasPublishRelease = capabilities.includes('publish_release');

  // read_repo only or read_repo + write_repo only
  const safeCapabilities =
    capabilities.includes('read_repo') &&
    (capabilities.length === 1 ||
      (capabilities.length === 2 && capabilities.includes('write_repo')));

  if (safeCapabilities && !hasInstallDeps && !hasNetworkAccess && !hasReadSecrets && !hasPublishRelease) {
    return {
      auto_activate: true,
      requiredActivationApprovals: [],
    };
  }

  // Determine required approvals based on capabilities
  const requiredApprovals = new Set<string>();

  if (hasInstallDeps || hasNetworkAccess || hasReadSecrets) {
    requiredApprovals.add('project_lead');
    requiredApprovals.add('security_reviewer');
  }

  if (hasPublishRelease) {
    requiredApprovals.add('project_lead');
    requiredApprovals.add('release_manager');
  }

  return {
    auto_activate: false,
    requiredActivationApprovals: Array.from(requiredApprovals),
  };
}

/**
 * Derive risk level from capabilities.
 */
export function deriveRiskLevel(
  capabilities: string[],
  factors?: {
    productionDataAccess?: boolean;
    externalSecretTransmission?: boolean;
    legalConcern?: boolean;
    rollbackImpossible?: boolean;
  }
): 'low' | 'medium' | 'high' | 'critical' {
  const hasWriteRepo = capabilities.includes('write_repo');
  const hasInstallDeps = capabilities.includes('install_deps');
  const hasNetworkAccess = capabilities.includes('network_access');
  const hasReadSecrets = capabilities.includes('read_secrets');
  const hasPublishRelease = capabilities.includes('publish_release');

  // Critical conditions
  if (factors?.productionDataAccess || factors?.externalSecretTransmission || factors?.legalConcern || factors?.rollbackImpossible) {
    return 'critical';
  }

  // High conditions
  if (hasInstallDeps || hasNetworkAccess || hasReadSecrets || hasPublishRelease) {
    return 'high';
  }

  // Medium conditions
  if (hasWriteRepo) {
    return 'medium';
  }

  // Low conditions
  return 'low';
}

/**
 * Create PublishGate from Acceptance.
 */
export function createPublishGate(
  acceptance: Acceptance,
  capabilities: string[],
  riskFactors?: Parameters<typeof deriveRiskLevel>[1]
): Omit<PublishGate, 'id' | 'version' | 'createdAt' | 'updatedAt'> {
  const riskLevel = deriveRiskLevel(capabilities, riskFactors);
  const now = new Date().toISOString();

  let requiredApprovals: string[] = [];
  let finalDecision: 'pending' | 'approved' | 'rejected' = 'pending';
  let approvalDeadline: string | undefined;

  switch (riskLevel) {
    case 'low':
    case 'medium':
      requiredApprovals = [];
      finalDecision = 'approved';
      break;
    case 'high':
      requiredApprovals = ['project_lead', 'security_reviewer'];
      // Set deadline to 24 hours from now
      approvalDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'critical':
      requiredApprovals = ['project_lead', 'security_reviewer', 'release_manager'];
      // Set deadline to 48 hours from now
      approvalDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      break;
  }

  return {
    kind: 'PublishGate',
    state: requiredApprovals.length === 0 ? 'Published' : 'Active',
    entityId: acceptance.id,
    action: 'publish',
    riskLevel,
    requiredApprovals,
    approvals: requiredApprovals.length === 0
      ? [
          {
            role: 'policy_engine',
            actorId: 'policy-engine',
            decision: 'approved' as const,
            decidedAt: now,
          },
        ]
      : [],
    finalDecision,
    approvalDeadline,
  };
}