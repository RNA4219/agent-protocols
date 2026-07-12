import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyApproval,
  createContractEvent,
  createContractId,
  createPublishGate,
  expireGate,
  ProtocolException,
  safeParseContract,
  safeParseEvent,
  validateContractGraph,
  validateTransition,
} from '../../src/index.js';
import { migrateV1 } from '../../src/migration/index.js';

const now = '2026-07-12T00:00:00.000Z';
const id = (kind: 'IntentContract' | 'TaskSeed' | 'Acceptance' | 'PublishGate' | 'Evidence') =>
  createContractId(kind, { now, random: new Uint8Array(10).fill(kind.length) });

function contracts() {
  const intent = {
    schemaVersion: '2.0.0' as const, id: id('IntentContract'), kind: 'IntentContract' as const,
    lifecycle: 'active' as const, revision: 1, createdAt: now, updatedAt: now,
    intent: 'v2 test', creator: 'tester', priority: 'low' as const, requestedCapabilities: ['read_repo' as const],
  };
  const taskSeed = {
    schemaVersion: '2.0.0' as const, id: id('TaskSeed'), kind: 'TaskSeed' as const,
    lifecycle: 'active' as const, revision: 1, createdAt: now, updatedAt: now, intentId: intent.id,
    description: 'run tests', ownerRole: 'developer' as const, executionPlan: ['test'],
    requestedCapabilitiesSnapshot: ['read_repo' as const],
    generationPolicy: { auto_activate: true, requiredActivationApprovals: [] as never[] },
  };
  const acceptance = {
    schemaVersion: '2.0.0' as const, id: id('Acceptance'), kind: 'Acceptance' as const,
    lifecycle: 'active' as const, revision: 1, createdAt: now, updatedAt: now, taskSeedId: taskSeed.id,
    status: 'passed' as const, details: 'passed', criteria: ['tests'],
    generationPolicy: { auto_activate: true, requiredActivationApprovals: [] as never[] },
  };
  return { intent, taskSeed, acceptance };
}

describe('agent-protocols v2', () => {
  const directories: string[] = [];
  afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

  it('rejects failed or blocked Acceptance when creating a gate', () => {
    const { acceptance } = contracts();
    for (const status of ['failed', 'blocked', 'pending'] as const) {
      expect(() => createPublishGate({ ...acceptance, status }, ['read_repo'], { clock: () => now })).toThrow(ProtocolException);
    }
  });

  it('enforces exact high-risk approvals and revisioned decisions', () => {
    const { acceptance } = contracts();
    const gate = createPublishGate(acceptance, ['read_repo', 'install_deps'], { clock: () => now });
    expect(gate.requiredApprovals).toEqual(['project_lead', 'security_reviewer']);
    expect(gate.decision).toBe('pending');
    const first = applyApproval(gate, { role: 'project_lead', actorId: 'lead', decision: 'approved' }, { clock: () => '2026-07-12T01:00:00.000Z' });
    expect(first.revision).toBe(2);
    expect(first.decision).toBe('pending');
    const final = applyApproval(first, { role: 'security_reviewer', actorId: 'security', decision: 'approved' }, { clock: () => '2026-07-12T02:00:00.000Z' });
    expect(final.lifecycle).toBe('final');
    expect(final.decision).toBe('approved');
    expect(final.revision).toBe(3);
    expect(() => applyApproval(first, { role: 'project_lead', actorId: 'other', decision: 'approved' })).toThrow(ProtocolException);
    expect(() => applyApproval(gate, { role: 'admin', actorId: 'admin', decision: 'approved' })).toThrow(ProtocolException);
  });

  it('expires pending gates as frozen and rejects late approval', () => {
    const { acceptance } = contracts();
    const gate = createPublishGate(acceptance, ['read_repo', 'network_access'], { clock: () => now });
    const expired = expireGate(gate, { clock: () => '2026-07-14T01:00:00.000Z' });
    expect(expired.lifecycle).toBe('frozen');
    expect(expired.decision).toBe('expired');
    expect(expired.revision).toBe(2);
    expect(() => applyApproval(gate, { role: 'project_lead', actorId: 'lead', decision: 'approved' }, { clock: () => '2026-07-14T01:00:00.000Z' })).toThrow(ProtocolException);
  });

  it('fails closed for unknown capability and invalid typed id', () => {
    const { intent } = contracts();
    const unknown = safeParseContract({ ...intent, requestedCapabilities: ['unknown'] });
    expect(unknown.success).toBe(false);
    expect(unknown.success ? undefined : unknown.errors[0].source).toBe('schema');
    const badId = safeParseContract({ ...intent, id: 'TaskSeed_01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    expect(badId.success).toBe(false);
  });

  it('validates immutable Evidence and publish references', () => {
    const { intent, taskSeed, acceptance } = contracts();
    const gate = createPublishGate(acceptance, ['read_repo'], { clock: () => now });
    const evidence = {
      schemaVersion: '2.0.0' as const, id: id('Evidence'), kind: 'Evidence' as const, lifecycle: 'final' as const,
      revision: 1 as const, createdAt: now, updatedAt: now, stage: 'publish' as const, taskSeedId: taskSeed.id,
      acceptanceId: acceptance.id, publishGateId: gate.id,
      baseCommit: { algorithm: 'git', value: 'base' }, headCommit: { algorithm: 'git', value: 'head' },
      inputHash: { algorithm: 'sha256', value: 'input' }, outputHash: { algorithm: 'sha256', value: 'output' },
      model: { name: 'model', version: '1', parametersHash: { algorithm: 'sha256', value: 'params' } },
      tools: [{ name: 'vitest', version: '3' }],
      environment: { os: 'windows', runtime: 'node20', containerImageDigest: { algorithm: 'sha256', value: 'image' }, lockfileHash: { algorithm: 'sha256', value: 'lock' } },
      staleStatus: { classification: 'fresh' as const, evaluatedAt: now },
      mergeResult: { status: 'not_applicable' as const }, startTime: now, endTime: now, actor: 'tester',
      approvalsSnapshot: gate.approvals, policyVerdict: 'approved' as const, diffHash: { algorithm: 'sha256', value: 'diff' },
    };
    expect(safeParseContract(evidence).success).toBe(true);
    expect(safeParseContract({ ...evidence, updatedAt: '2026-07-12T00:00:01.000Z' }).success).toBe(false);
    expect(validateContractGraph([intent, taskSeed, acceptance, gate, evidence]).valid).toBe(true);
    const changed = { ...evidence, revision: 2 as const };
    expect(validateTransition(evidence, changed).valid).toBe(false);
  });

  it('creates and parses CloudEvents with required correlation fields', () => {
    const { acceptance } = contracts();
    const gate = createPublishGate(acceptance, ['read_repo'], { clock: () => now });
    const event = createContractEvent(gate, { clock: () => now, correlationid: 'corr', causationid: 'cause', idempotencykey: 'idem' });
    expect(event.specversion).toBe('1.0');
    expect(safeParseEvent(event).success).toBe(true);
    expect(safeParseEvent({ ...event, correlationid: undefined }).success).toBe(false);
  });

  it('migrates v1 JSONL deterministically without overwriting output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agent-protocols-v1-'));
    directories.push(directory);
    const input = join(directory, 'input.jsonl');
    const outputA = join(directory, 'out-a');
    const outputB = join(directory, 'out-b');
    const records = [
      { schemaVersion: '1.0.0', id: 'IC-001', kind: 'IntentContract', state: 'Active', version: 1, createdAt: now, updatedAt: now, intent: 'migrate', creator: 'tester', priority: 'low', requestedCapabilities: ['read_repo'] },
      { schemaVersion: '1.0.0', id: 'TS-001', kind: 'TaskSeed', state: 'Active', version: 1, createdAt: now, updatedAt: now, intentId: 'IC-001', description: 'test', ownerRole: 'developer', executionPlan: ['test'], requestedCapabilitiesSnapshot: ['read_repo'], generationPolicy: { auto_activate: true, requiredActivationApprovals: [] } },
      { schemaVersion: '1.0.0', id: 'AC-001', kind: 'Acceptance', state: 'Active', version: 1, createdAt: now, updatedAt: now, taskSeedId: 'TS-001', status: 'passed', details: 'ok', criteria: ['ok'], generationPolicy: { auto_activate: true, requiredActivationApprovals: [] } },
      { schemaVersion: '1.0.0', id: 'PG-001', kind: 'PublishGate', state: 'Published', version: 1, createdAt: now, updatedAt: now, entityId: 'AC-001', action: 'publish', riskLevel: 'low', requiredApprovals: [], approvals: [{ role: 'policy_engine', actorId: 'policy-engine', decision: 'approved', decidedAt: now }], finalDecision: 'approved' },
    ];
    writeFileSync(input, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
    migrateV1(input, 'test', outputA);
    migrateV1(input, 'test', outputB);
    expect(readFileSync(join(outputA, 'id-map.json'), 'utf8')).toBe(readFileSync(join(outputB, 'id-map.json'), 'utf8'));
    expect(() => migrateV1(input, 'test', outputA)).toThrow(ProtocolException);
  });
});
