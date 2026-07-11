import type { Capability, Priority, RiskLevel, GenerationPolicy } from './generated/contracts.js';
import { ProtocolException, protocolError } from './errors.js';

export interface RiskFactors {
  productionDataAccess?: boolean;
  externalSecretTransmission?: boolean;
  legalConcern?: boolean;
  rollbackImpossible?: boolean;
}

export type Clock = () => Date | string;
export interface PolicyAssessment {
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  requiredApprovals: Exclude<import('./generated/contracts.js').ApprovalRole, 'policy_engine' | 'admin'>[];
  approvalDeadline?: string;
  autoApproved: boolean;
}

const CAPABILITIES: Capability[] = ['read_repo', 'write_repo', 'install_deps', 'network_access', 'read_secrets', 'publish_release'];
const REQUIRED: Record<Priority, PolicyAssessment['requiredApprovals']> = {
  low: [], medium: [], high: ['project_lead', 'security_reviewer'],
  critical: ['project_lead', 'security_reviewer', 'release_manager'],
};

function assertCapabilities(capabilities: readonly string[]): asserts capabilities is readonly Capability[] {
  const unknown = capabilities.filter((capability) => !CAPABILITIES.includes(capability as Capability));
  if (unknown.length > 0 || new Set(capabilities).size !== capabilities.length) {
    throw new ProtocolException('Unknown or duplicate capability', [protocolError('UNKNOWN_CAPABILITY', '/capabilities', 'Capabilities must be known and unique', 'semantic')]);
  }
}

function nowUtc(clock: Clock | undefined): string {
  const value = clock ? clock() : new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid policy clock value');
  return date.toISOString();
}

export function deriveGenerationPolicy(capabilities: readonly string[]): GenerationPolicy {
  assertCapabilities(capabilities);
  const safe = capabilities.length === 1 && capabilities[0] === 'read_repo'
    || capabilities.length === 2 && capabilities.includes('read_repo') && capabilities.includes('write_repo');
  if (safe) return { auto_activate: true, requiredActivationApprovals: [] };
  const approvals = new Set<GenerationPolicy['requiredActivationApprovals'][number]>();
  if (capabilities.some((capability) => ['install_deps', 'network_access', 'read_secrets'].includes(capability))) {
    approvals.add('project_lead');
    approvals.add('security_reviewer');
  }
  if (capabilities.includes('publish_release')) {
    approvals.add('project_lead');
    approvals.add('release_manager');
  }
  return { auto_activate: false, requiredActivationApprovals: [...approvals] };
}

export function deriveRiskLevel(capabilities: readonly string[], factors: RiskFactors = {}): RiskLevel {
  assertCapabilities(capabilities);
  if (factors.productionDataAccess || factors.externalSecretTransmission || factors.legalConcern || factors.rollbackImpossible) return 'critical';
  if (capabilities.some((capability) => ['install_deps', 'network_access', 'read_secrets', 'publish_release'].includes(capability))) return 'high';
  if (capabilities.includes('write_repo')) return 'medium';
  return 'low';
}

export function assessPolicy(
  capabilities: readonly string[],
  factors: RiskFactors = {},
  options: { clock?: Clock } = {},
): PolicyAssessment {
  const riskLevel = deriveRiskLevel(capabilities, factors);
  const requiredApprovals = REQUIRED[riskLevel];
  const autoApproved = requiredApprovals.length === 0;
  const result: PolicyAssessment = {
    riskLevel,
    requiresApproval: !autoApproved,
    requiredApprovals: [...requiredApprovals],
    autoApproved,
  };
  if (!autoApproved) {
    const hours = riskLevel === 'critical' ? 48 : 24;
    result.approvalDeadline = new Date(new Date(nowUtc(options.clock)).getTime() + hours * 60 * 60 * 1000).toISOString();
  }
  return result;
}
