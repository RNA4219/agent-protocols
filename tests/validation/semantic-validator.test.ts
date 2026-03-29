import { describe, it, expect, beforeEach } from 'vitest';
import {
  SemanticValidator,
  validateCapabilitiesMatch,
  deriveGenerationPolicy,
  deriveRiskLevel,
  createPublishGate,
  type IntentContract,
  type TaskSeed,
  type Acceptance,
  type PublishGate,
  type Evidence,
} from '../../src/validation/index.js';

describe('SemanticValidator', () => {
  let validator: SemanticValidator;

  beforeEach(() => {
    validator = new SemanticValidator();
  });

  describe('Evidence Validation', () => {
    const createValidEvidence = (): Evidence => ({
      schemaVersion: '1.0.0',
      id: 'EV-001',
      kind: 'Evidence',
      state: 'Published',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      taskSeedId: 'TS-001',
      baseCommit: 'a1b2c3d',
      headCommit: 'e4f5g6h',
      inputHash: 'sha256:abc',
      outputHash: 'sha256:def',
      model: {
        name: 'claude-sonnet-4-6',
        version: '20250514',
        parametersHash: 'sha256:params',
      },
      tools: ['Read', 'Edit'],
      environment: {
        os: 'Linux',
        runtime: 'Node.js 20',
        containerImageDigest: 'sha256:container',
        lockfileHash: 'sha256:lock',
      },
      staleStatus: {
        classification: 'fresh',
        evaluatedAt: '2026-03-29T09:00:00Z',
      },
      mergeResult: {
        status: 'merged',
        mergedAt: '2026-03-29T09:30:00Z',
      },
      startTime: '2026-03-29T08:00:00Z',
      endTime: '2026-03-29T09:00:00Z',
      actor: 'developer-001',
      policyVerdict: 'approved',
      diffHash: 'sha256:diff',
    });

    it('should validate a valid Evidence', () => {
      const evidence = createValidEvidence();
      const result = validator.validate(evidence);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject Evidence with startTime > endTime', () => {
      const evidence = createValidEvidence();
      evidence.startTime = '2026-03-29T10:00:00Z';
      evidence.endTime = '2026-03-29T09:00:00Z';

      const result = validator.validate(evidence);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'startTime')).toBe(true);
    });

    it('should reject Evidence with state other than Published', () => {
      const evidence = createValidEvidence();
      evidence.state = 'Draft';

      const result = validator.validate(evidence);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'state')).toBe(true);
    });

    it('should require approvalsSnapshot when policyVerdict is manual_review_required', () => {
      const evidence = createValidEvidence();
      evidence.policyVerdict = 'manual_review_required';

      const result = validator.validate(evidence);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'approvalsSnapshot')).toBe(true);
    });

    it('should pass when approvalsSnapshot is present with manual_review_required', () => {
      const evidence = createValidEvidence();
      evidence.policyVerdict = 'manual_review_required';
      evidence.approvalsSnapshot = [
        {
          role: 'project_lead',
          actorId: 'lead-001',
          decision: 'approved',
          decidedAt: '2026-03-29T09:30:00Z',
        },
      ];

      const result = validator.validate(evidence);
      expect(result.valid).toBe(true);
    });
  });

  describe('PublishGate Validation', () => {
    const createValidPublishGate = (): PublishGate => ({
      schemaVersion: '1.0.0',
      id: 'PG-001',
      kind: 'PublishGate',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      entityId: 'AC-001',
      action: 'publish',
      riskLevel: 'low',
      requiredApprovals: [],
      approvals: [
        {
          role: 'policy_engine',
          actorId: 'policy-engine',
          decision: 'approved',
          decidedAt: '2026-03-29T10:00:00Z',
        },
      ],
      finalDecision: 'approved',
    });

    it('should validate a valid low-risk PublishGate', () => {
      const gate = createValidPublishGate();
      const result = validator.validate(gate);
      expect(result.valid).toBe(true);
    });

    it('should reject empty requiredApprovals with pending finalDecision', () => {
      const gate = createValidPublishGate();
      gate.requiredApprovals = [];
      gate.finalDecision = 'pending';

      const result = validator.validate(gate);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'finalDecision')).toBe(true);
    });

    it('should require approvalDeadline when requiredApprovals is not empty', () => {
      const gate = createValidPublishGate();
      gate.riskLevel = 'high';
      gate.requiredApprovals = ['project_lead', 'security_reviewer'];
      gate.finalDecision = 'pending';
      // Missing approvalDeadline

      const result = validator.validate(gate);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'approvalDeadline')).toBe(true);
    });

    it('should pass high-risk PublishGate with approvalDeadline', () => {
      const gate = createValidPublishGate();
      gate.riskLevel = 'high';
      gate.requiredApprovals = ['project_lead', 'security_reviewer'];
      gate.finalDecision = 'pending';
      gate.approvalDeadline = '2026-03-30T10:00:00Z';

      const result = validator.validate(gate);
      expect(result.valid).toBe(true);
    });

    it('should reject approved finalDecision without all required approvals', () => {
      const gate = createValidPublishGate();
      gate.riskLevel = 'high';
      gate.requiredApprovals = ['project_lead', 'security_reviewer'];
      gate.approvalDeadline = '2026-03-30T10:00:00Z';
      gate.approvals = [
        {
          role: 'project_lead',
          actorId: 'lead-001',
          decision: 'approved',
          decidedAt: '2026-03-29T10:30:00Z',
        },
      ];
      // Missing security_reviewer approval
      gate.finalDecision = 'approved';

      const result = validator.validate(gate);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('security_reviewer'))).toBe(true);
    });

    it('should pass when all required approvals are met', () => {
      const gate = createValidPublishGate();
      gate.riskLevel = 'high';
      gate.requiredApprovals = ['project_lead', 'security_reviewer'];
      gate.approvalDeadline = '2026-03-30T10:00:00Z';
      gate.approvals = [
        {
          role: 'project_lead',
          actorId: 'lead-001',
          decision: 'approved',
          decidedAt: '2026-03-29T10:30:00Z',
        },
        {
          role: 'security_reviewer',
          actorId: 'security-001',
          decision: 'approved',
          decidedAt: '2026-03-29T11:00:00Z',
        },
      ];
      gate.finalDecision = 'approved';

      const result = validator.validate(gate);
      expect(result.valid).toBe(true);
    });
  });

  describe('TaskSeed Validation', () => {
    const createValidTaskSeed = (): TaskSeed => ({
      schemaVersion: '1.0.0',
      id: 'TS-001',
      kind: 'TaskSeed',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      intentId: 'IC-001',
      description: 'Test task',
      ownerRole: 'developer',
      executionPlan: ['step1'],
      requestedCapabilitiesSnapshot: ['read_repo'],
      generationPolicy: {
        auto_activate: true,
        requiredActivationApprovals: [],
      },
    });

    it('should validate a valid TaskSeed', () => {
      const taskSeed = createValidTaskSeed();
      const result = validator.validate(taskSeed);
      expect(result.valid).toBe(true);
    });

    it('should reject auto_activate=false with empty requiredActivationApprovals', () => {
      const taskSeed = createValidTaskSeed();
      taskSeed.generationPolicy.auto_activate = false;
      taskSeed.generationPolicy.requiredActivationApprovals = [];

      const result = validator.validate(taskSeed);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'generationPolicy.requiredActivationApprovals')).toBe(true);
    });

    it('should pass auto_activate=false with requiredActivationApprovals', () => {
      const taskSeed = createValidTaskSeed();
      taskSeed.generationPolicy.auto_activate = false;
      taskSeed.generationPolicy.requiredActivationApprovals = ['project_lead'];

      const result = validator.validate(taskSeed);
      expect(result.valid).toBe(true);
    });
  });

  describe('Acceptance Validation', () => {
    const createValidAcceptance = (): Acceptance => ({
      schemaVersion: '1.0.0',
      id: 'AC-001',
      kind: 'Acceptance',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T12:00:00Z',
      updatedAt: '2026-03-29T12:00:00Z',
      taskSeedId: 'TS-001',
      status: 'passed',
      details: 'All criteria met',
      criteria: ['test1', 'test2'],
      generationPolicy: {
        auto_activate: true,
        requiredActivationApprovals: [],
      },
    });

    it('should validate a valid Acceptance', () => {
      const acceptance = createValidAcceptance();
      const result = validator.validate(acceptance);
      expect(result.valid).toBe(true);
    });

    it('should reject auto_activate=false with empty requiredActivationApprovals', () => {
      const acceptance = createValidAcceptance();
      acceptance.generationPolicy.auto_activate = false;
      acceptance.generationPolicy.requiredActivationApprovals = [];

      const result = validator.validate(acceptance);
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateCapabilitiesMatch', () => {
  it('should pass when capabilities match', () => {
    const intent: IntentContract = {
      schemaVersion: '1.0.0',
      id: 'IC-001',
      kind: 'IntentContract',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      intent: 'Test',
      creator: 'user-001',
      priority: 'medium',
      requestedCapabilities: ['read_repo', 'write_repo'],
    };

    const taskSeed: TaskSeed = {
      schemaVersion: '1.0.0',
      id: 'TS-001',
      kind: 'TaskSeed',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      intentId: 'IC-001',
      description: 'Test',
      ownerRole: 'developer',
      executionPlan: ['step1'],
      requestedCapabilitiesSnapshot: ['read_repo', 'write_repo'],
      generationPolicy: { auto_activate: true, requiredActivationApprovals: [] },
    };

    const result = validateCapabilitiesMatch(taskSeed, intent);
    expect(result.valid).toBe(true);
  });

  it('should fail when capabilities do not match', () => {
    const intent: IntentContract = {
      schemaVersion: '1.0.0',
      id: 'IC-001',
      kind: 'IntentContract',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      intent: 'Test',
      creator: 'user-001',
      priority: 'medium',
      requestedCapabilities: ['read_repo', 'write_repo', 'network_access'],
    };

    const taskSeed: TaskSeed = {
      schemaVersion: '1.0.0',
      id: 'TS-001',
      kind: 'TaskSeed',
      state: 'Active',
      version: 1,
      createdAt: '2026-03-29T10:00:00Z',
      updatedAt: '2026-03-29T10:00:00Z',
      intentId: 'IC-001',
      description: 'Test',
      ownerRole: 'developer',
      executionPlan: ['step1'],
      requestedCapabilitiesSnapshot: ['read_repo', 'write_repo'],
      generationPolicy: { auto_activate: true, requiredActivationApprovals: [] },
    };

    const result = validateCapabilitiesMatch(taskSeed, intent);
    expect(result.valid).toBe(false);
  });
});

describe('deriveGenerationPolicy', () => {
  it('should auto-activate for read_repo only', () => {
    const policy = deriveGenerationPolicy(['read_repo']);
    expect(policy.auto_activate).toBe(true);
    expect(policy.requiredActivationApprovals).toEqual([]);
  });

  it('should auto-activate for read_repo + write_repo only', () => {
    const policy = deriveGenerationPolicy(['read_repo', 'write_repo']);
    expect(policy.auto_activate).toBe(true);
    expect(policy.requiredActivationApprovals).toEqual([]);
  });

  it('should not auto-activate for install_deps', () => {
    const policy = deriveGenerationPolicy(['read_repo', 'install_deps']);
    expect(policy.auto_activate).toBe(false);
    expect(policy.requiredActivationApprovals).toContain('project_lead');
    expect(policy.requiredActivationApprovals).toContain('security_reviewer');
  });

  it('should not auto-activate for network_access', () => {
    const policy = deriveGenerationPolicy(['read_repo', 'network_access']);
    expect(policy.auto_activate).toBe(false);
    expect(policy.requiredActivationApprovals).toContain('security_reviewer');
  });

  it('should not auto-activate for read_secrets', () => {
    const policy = deriveGenerationPolicy(['read_repo', 'read_secrets']);
    expect(policy.auto_activate).toBe(false);
    expect(policy.requiredActivationApprovals).toContain('security_reviewer');
  });

  it('should not auto-activate for publish_release', () => {
    const policy = deriveGenerationPolicy(['read_repo', 'publish_release']);
    expect(policy.auto_activate).toBe(false);
    expect(policy.requiredActivationApprovals).toContain('project_lead');
    expect(policy.requiredActivationApprovals).toContain('release_manager');
  });

  it('should combine approvals for multiple high-risk capabilities', () => {
    const policy = deriveGenerationPolicy(['read_repo', 'install_deps', 'publish_release']);
    expect(policy.auto_activate).toBe(false);
    expect(policy.requiredActivationApprovals).toContain('project_lead');
    expect(policy.requiredActivationApprovals).toContain('security_reviewer');
    expect(policy.requiredActivationApprovals).toContain('release_manager');
  });
});

describe('deriveRiskLevel', () => {
  it('should return low for read_repo only', () => {
    const level = deriveRiskLevel(['read_repo']);
    expect(level).toBe('low');
  });

  it('should return medium for write_repo', () => {
    const level = deriveRiskLevel(['read_repo', 'write_repo']);
    expect(level).toBe('medium');
  });

  it('should return high for install_deps', () => {
    const level = deriveRiskLevel(['read_repo', 'install_deps']);
    expect(level).toBe('high');
  });

  it('should return high for network_access', () => {
    const level = deriveRiskLevel(['read_repo', 'network_access']);
    expect(level).toBe('high');
  });

  it('should return high for read_secrets', () => {
    const level = deriveRiskLevel(['read_repo', 'read_secrets']);
    expect(level).toBe('high');
  });

  it('should return high for publish_release', () => {
    const level = deriveRiskLevel(['read_repo', 'publish_release']);
    expect(level).toBe('high');
  });

  it('should return critical for production data access', () => {
    const level = deriveRiskLevel(['read_repo'], { productionDataAccess: true });
    expect(level).toBe('critical');
  });

  it('should return critical for external secret transmission', () => {
    const level = deriveRiskLevel(['read_repo'], { externalSecretTransmission: true });
    expect(level).toBe('critical');
  });

  it('should return critical for legal concern', () => {
    const level = deriveRiskLevel(['read_repo'], { legalConcern: true });
    expect(level).toBe('critical');
  });

  it('should return critical for rollback impossible', () => {
    const level = deriveRiskLevel(['read_repo'], { rollbackImpossible: true });
    expect(level).toBe('critical');
  });
});

describe('createPublishGate', () => {
  const createAcceptance = (): Acceptance => ({
    schemaVersion: '1.0.0',
    id: 'AC-001',
    kind: 'Acceptance',
    state: 'Active',
    version: 1,
    createdAt: '2026-03-29T12:00:00Z',
    updatedAt: '2026-03-29T12:00:00Z',
    taskSeedId: 'TS-001',
    status: 'passed',
    details: 'All criteria met',
    criteria: ['test1'],
    generationPolicy: { auto_activate: true, requiredActivationApprovals: [] },
  });

  it('should create auto-approved PublishGate for low risk', () => {
    const gate = createPublishGate(createAcceptance(), ['read_repo']);
    expect(gate.riskLevel).toBe('low');
    expect(gate.requiredApprovals).toEqual([]);
    expect(gate.finalDecision).toBe('approved');
    expect(gate.state).toBe('Published');
  });

  it('should create auto-approved PublishGate for medium risk', () => {
    const gate = createPublishGate(createAcceptance(), ['read_repo', 'write_repo']);
    expect(gate.riskLevel).toBe('medium');
    expect(gate.requiredApprovals).toEqual([]);
    expect(gate.finalDecision).toBe('approved');
  });

  it('should create pending PublishGate for high risk', () => {
    const gate = createPublishGate(createAcceptance(), ['read_repo', 'install_deps']);
    expect(gate.riskLevel).toBe('high');
    expect(gate.requiredApprovals).toContain('project_lead');
    expect(gate.requiredApprovals).toContain('security_reviewer');
    expect(gate.finalDecision).toBe('pending');
    expect(gate.approvalDeadline).toBeDefined();
    expect(gate.state).toBe('Active');
  });

  it('should create pending PublishGate for critical risk', () => {
    const gate = createPublishGate(createAcceptance(), ['read_repo'], { productionDataAccess: true });
    expect(gate.riskLevel).toBe('critical');
    expect(gate.requiredApprovals).toContain('project_lead');
    expect(gate.requiredApprovals).toContain('security_reviewer');
    expect(gate.requiredApprovals).toContain('release_manager');
    expect(gate.finalDecision).toBe('pending');
    expect(gate.approvalDeadline).toBeDefined();
  });
});