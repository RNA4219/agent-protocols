/**
 * Demo script to verify agent-protocols functionality.
 * Run with: node --experimental-strip-types demo.ts
 */

import { SemanticValidator, deriveGenerationPolicy, deriveRiskLevel, createPublishGate } from '../src/validation/index.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('=== agent-protocols Demo ===\n');

// 1. Schema Validation
console.log('1. Schema Validation Test');
console.log('---------------------------');

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const schemasDir = join(process.cwd(), 'schemas');

// Load schemas
const commonSchema = JSON.parse(readFileSync(join(schemasDir, 'common.schema.json'), 'utf-8'));
ajv.addSchema(commonSchema);

const intentSchema = JSON.parse(readFileSync(join(schemasDir, 'IntentContract.schema.json'), 'utf-8'));
ajv.addSchema(intentSchema);

const taskSeedSchema = JSON.parse(readFileSync(join(schemasDir, 'TaskSeed.schema.json'), 'utf-8'));
ajv.addSchema(taskSeedSchema);

const evidenceSchema = JSON.parse(readFileSync(join(schemasDir, 'Evidence.schema.json'), 'utf-8'));
ajv.addSchema(evidenceSchema);

// Test IntentContract
const validIntent = {
  schemaVersion: '1.0.0',
  id: 'IC-001',
  kind: 'IntentContract',
  state: 'Active',
  version: 1,
  createdAt: '2026-03-29T10:00:00Z',
  updatedAt: '2026-03-29T10:00:00Z',
  intent: 'Implement user authentication',
  creator: 'developer-001',
  priority: 'medium',
  requestedCapabilities: ['read_repo', 'write_repo'],
};

const intentValidator = ajv.getSchema('https://agent-protocols/schemas/IntentContract.schema.json');
const intentValid = intentValidator?.(validIntent);
console.log(`IntentContract validation: ${intentValid ? '✅ PASS' : '❌ FAIL'}`);

// Test invalid IntentContract
const invalidIntent = { ...validIntent, id: 'INVALID-ID' };
const invalidIntentResult = intentValidator?.(invalidIntent);
console.log(`Invalid ID rejection: ${!invalidIntentResult ? '✅ PASS' : '❌ FAIL'}`);

console.log('');

// 2. Semantic Validation
console.log('2. Semantic Validation Test');
console.log('----------------------------');

const semanticValidator = new SemanticValidator();

// Test valid Evidence
const validEvidence = {
  schemaVersion: '1.0.0',
  id: 'EV-001',
  kind: 'Evidence',
  state: 'Published',
  version: 1,
  createdAt: '2026-03-29T10:00:00Z',
  updatedAt: '2026-03-29T10:00:00Z',
  taskSeedId: 'TS-001',
  baseCommit: 'abc1234',
  headCommit: 'def5678',
  inputHash: 'sha256:input',
  outputHash: 'sha256:output',
  model: { name: 'claude', version: '1.0', parametersHash: 'sha256:params' },
  tools: ['Read', 'Edit'],
  environment: { os: 'Linux', runtime: 'Node', containerImageDigest: 'sha256:container', lockfileHash: 'sha256:lock' },
  staleStatus: { classification: 'fresh', evaluatedAt: '2026-03-29T09:00:00Z' },
  mergeResult: { status: 'merged' },
  startTime: '2026-03-29T08:00:00Z',
  endTime: '2026-03-29T09:00:00Z',
  actor: 'dev-001',
  policyVerdict: 'approved',
  diffHash: 'sha256:diff',
};

const evidenceResult = semanticValidator.validate(validEvidence);
console.log(`Valid Evidence: ${evidenceResult.valid ? '✅ PASS' : '❌ FAIL'}`);

// Test invalid Evidence (startTime > endTime)
const invalidEvidence = {
  ...validEvidence,
  startTime: '2026-03-29T10:00:00Z',
  endTime: '2026-03-29T09:00:00Z',
};
const invalidEvidenceResult = semanticValidator.validate(invalidEvidence);
console.log(`Invalid time order rejection: ${!invalidEvidenceResult.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Error: ${invalidEvidenceResult.errors[0]?.message}`);

console.log('');

// 3. Generation Policy Derivation
console.log('3. Generation Policy Derivation');
console.log('--------------------------------');

const safePolicy = deriveGenerationPolicy(['read_repo', 'write_repo']);
console.log(`Safe capabilities (read + write):`);
console.log(`  auto_activate: ${safePolicy.auto_activate} ${safePolicy.auto_activate ? '✅' : ''}`);
console.log(`  requiredApprovals: [${safePolicy.requiredActivationApprovals.join(', ')}]`);

const riskyPolicy = deriveGenerationPolicy(['install_deps', 'network_access']);
console.log(`Risky capabilities (install_deps + network_access):`);
console.log(`  auto_activate: ${riskyPolicy.auto_activate} ${!riskyPolicy.auto_activate ? '✅' : ''}`);
console.log(`  requiredApprovals: [${riskyPolicy.requiredActivationApprovals.join(', ')}]`);

console.log('');

// 4. Risk Level Derivation
console.log('4. Risk Level Derivation');
console.log('-------------------------');

const lowRisk = deriveRiskLevel(['read_repo']);
console.log(`read_repo only: ${lowRisk} ${lowRisk === 'low' ? '✅' : ''}`);

const mediumRisk = deriveRiskLevel(['read_repo', 'write_repo']);
console.log(`read + write_repo: ${mediumRisk} ${mediumRisk === 'medium' ? '✅' : ''}`);

const highRisk = deriveRiskLevel(['install_deps']);
console.log(`install_deps: ${highRisk} ${highRisk === 'high' ? '✅' : ''}`);

const criticalRisk = deriveRiskLevel(['read_repo'], { productionDataAccess: true });
console.log(`production data access: ${criticalRisk} ${criticalRisk === 'critical' ? '✅' : ''}`);

console.log('');

// 5. Full Flow Test
console.log('5. Full Contract Flow Test');
console.log('---------------------------');

const acceptance = {
  schemaVersion: '1.0.0',
  id: 'AC-001',
  kind: 'Acceptance',
  state: 'Active',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  taskSeedId: 'TS-001',
  status: 'passed',
  details: 'All tests passed',
  criteria: ['unit-test', 'integration-test'],
  generationPolicy: { auto_activate: true, requiredActivationApprovals: [] },
};

const lowRiskGate = createPublishGate(acceptance, ['read_repo', 'write_repo']);
console.log(`Low risk PublishGate:`);
console.log(`  riskLevel: ${lowRiskGate.riskLevel}`);
console.log(`  finalDecision: ${lowRiskGate.finalDecision} ${lowRiskGate.finalDecision === 'approved' ? '✅' : ''}`);
console.log(`  state: ${lowRiskGate.state}`);

console.log('');

console.log('=== All demos completed ===');