import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { Contract, ContractKind, ApprovalRecord } from '../generated/contracts.js';
import { createDeterministicContractId } from '../id.js';
import { safeParseContract } from '../validation-v2.js';
import { validateContractGraph } from '../graph.js';
import { ProtocolException, protocolError } from '../errors.js';

const KINDS: ContractKind[] = ['IntentContract', 'TaskSeed', 'Acceptance', 'PublishGate', 'Evidence'];
const CAPABILITIES = new Set(['read_repo', 'write_repo', 'install_deps', 'network_access', 'read_secrets', 'publish_release']);
const STATES = new Set(['Draft', 'Active', 'Frozen', 'Published', 'Superseded', 'Revoked', 'Archived']);
const STATE_MAP: Record<string, Contract['lifecycle']> = {
  Draft: 'draft', Active: 'active', Frozen: 'frozen', Published: 'final',
  Superseded: 'superseded', Revoked: 'revoked', Archived: 'archived',
};
const PREFIX: Record<ContractKind, string> = {
  IntentContract: 'IC', TaskSeed: 'TS', Acceptance: 'AC', PublishGate: 'PG', Evidence: 'EV',
};

export interface MigrationReport {
  success: true;
  schemaVersion: '2.0.0';
  namespace: string;
  inputPath: string;
  contractCount: number;
  migratedAt: string;
}

function fail(code: string, path: string, message: string): never {
  throw new ProtocolException(message, [protocolError(code, path, message, 'schema')]);
}

function parseInput(inputPath: string): Record<string, unknown>[] {
  if (!isAbsolute(inputPath)) fail('INPUT_PATH_NOT_ABSOLUTE', '/', 'Input path must be absolute');
  if (!existsSync(inputPath)) fail('INPUT_NOT_FOUND', '/', 'Input file does not exist');
  const text = readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!text) fail('INPUT_EMPTY', '/', 'Input file is empty');
  try {
    const value = JSON.parse(text) as unknown;
    const records = Array.isArray(value) ? value : [value];
    if (records.every((record) => Boolean(record) && typeof record === 'object' && !Array.isArray(record))) return records as Record<string, unknown>[];
  } catch {
    // JSONL is parsed below.
  }
  const records: Record<string, unknown>[] = [];
  for (const [lineNumber, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT_RECORD_INVALID', '/line/' + (lineNumber + 1), 'JSONL record must be an object');
      records.push(value as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ProtocolException) throw error;
      fail('INPUT_JSON_INVALID', '/line/' + (lineNumber + 1), 'Invalid JSON or JSONL input');
    }
  }
  if (records.length === 0) fail('INPUT_EMPTY', '/', 'Input contains no records');
  return records;
}

function checkApproval(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('V1_APPROVAL_INVALID', path, 'Approval record must be an object');
  const approval = value as Record<string, unknown>;
  if (!['project_lead', 'security_reviewer', 'release_manager', 'policy_engine', 'admin'].includes(String(approval.role))) fail('UNKNOWN_ROLE', path + '/role', 'Unknown approval role');
  if (!['approved', 'rejected'].includes(String(approval.decision))) fail('V1_APPROVAL_INVALID', path + '/decision', 'Invalid approval decision');
  if (typeof approval.actorId !== 'string' || typeof approval.decidedAt !== 'string') fail('V1_APPROVAL_INVALID', path, 'Approval actorId and decidedAt are required');
}

function validateV1(record: Record<string, unknown>, index: number): void {
  const path = '/contracts/' + index;
  const kind = record.kind;
  if (!KINDS.includes(kind as ContractKind)) fail('UNKNOWN_KIND', path + '/kind', 'Unknown v1 contract kind');
  const prefix = PREFIX[kind as ContractKind];
  if (record.schemaVersion !== '1.0.0') fail('V1_SCHEMA_VERSION', path + '/schemaVersion', 'Input must be a v1 contract');
  if (typeof record.id !== 'string' || !new RegExp('^' + prefix + '-[0-9]{3,}$').test(record.id)) fail('V1_ID_INVALID', path + '/id', 'Invalid v1 contract id');
  if (typeof record.state !== 'string' || !STATES.has(record.state)) fail('V1_STATE_INVALID', path + '/state', 'Invalid v1 state');
  if (!Number.isInteger(record.version) || Number(record.version) < 1) fail('V1_VERSION_INVALID', path + '/version', 'Invalid v1 version');
  if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt))) fail('V1_TIMESTAMP_INVALID', path + '/createdAt', 'Invalid createdAt');
  if (typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) fail('V1_TIMESTAMP_INVALID', path + '/updatedAt', 'Invalid updatedAt');
  if (kind === 'IntentContract') {
    if (typeof record.intent !== 'string' || typeof record.creator !== 'string') fail('V1_FIELD_REQUIRED', path, 'IntentContract fields are incomplete');
    if (!Array.isArray(record.requestedCapabilities) || record.requestedCapabilities.length === 0 || record.requestedCapabilities.some((cap) => !CAPABILITIES.has(String(cap)))) fail('UNKNOWN_CAPABILITY', path + '/requestedCapabilities', 'Unknown capability');
  }
  if (kind === 'TaskSeed') {
    if (typeof record.intentId !== 'string' || typeof record.description !== 'string' || !Array.isArray(record.executionPlan)) fail('V1_FIELD_REQUIRED', path, 'TaskSeed fields are incomplete');
    if (!Array.isArray(record.requestedCapabilitiesSnapshot) || record.requestedCapabilitiesSnapshot.some((cap) => !CAPABILITIES.has(String(cap)))) fail('UNKNOWN_CAPABILITY', path + '/requestedCapabilitiesSnapshot', 'Unknown capability');
  }
  if (kind === 'Acceptance') {
    if (typeof record.taskSeedId !== 'string' || !['pending', 'passed', 'failed', 'blocked'].includes(String(record.status))) fail('V1_FIELD_REQUIRED', path, 'Acceptance fields are incomplete');
  }
  if (kind === 'PublishGate') {
    if (typeof record.entityId !== 'string' || record.action !== 'publish' || !['low', 'medium', 'high', 'critical'].includes(String(record.riskLevel))) fail('V1_FIELD_REQUIRED', path, 'PublishGate v1 fields are incomplete');
    if (!Array.isArray(record.approvals) || !Array.isArray(record.requiredApprovals)) fail('V1_FIELD_REQUIRED', path, 'PublishGate approvals are incomplete');
    record.approvals.forEach((approval, approvalIndex) => checkApproval(approval, path + '/approvals/' + approvalIndex));
  }
  if (kind === 'Evidence') {
    if (typeof record.taskSeedId !== 'string' || typeof record.actor !== 'string') fail('V1_FIELD_REQUIRED', path, 'Evidence fields are incomplete');
    if (Array.isArray(record.approvalsSnapshot)) record.approvalsSnapshot.forEach((approval, approvalIndex) => checkApproval(approval, path + '/approvalsSnapshot/' + approvalIndex));
  }
}

function hash(value: unknown, algorithm: string): { algorithm: string; value: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    if (typeof item.algorithm === 'string' && typeof item.value === 'string') return { algorithm: item.algorithm, value: item.value };
  }
  if (typeof value !== 'string' || value.length === 0) fail('V1_HASH_INVALID', '/', 'Commit/hash value is required');
  return { algorithm, value };
}

function approval(value: Record<string, unknown>): ApprovalRecord {
  const result: ApprovalRecord = {
    role: String(value.role) as ApprovalRecord['role'],
    actorId: String(value.actorId),
    decision: String(value.decision) as ApprovalRecord['decision'],
    decidedAt: String(value.decidedAt),
  };
  if (value.reason !== undefined) result.reason = String(value.reason);
  return result;
}

function ref(id: unknown, map: Map<string, string>, path: string): string | undefined {
  if (id === undefined) return undefined;
  if (typeof id !== 'string' || !map.has(id)) fail('REFERENCE_NOT_FOUND', path, 'Referenced v1 id was not found');
  return map.get(id);
}

function transform(record: Record<string, unknown>, map: Map<string, string>): Record<string, unknown> {
  const kind = record.kind as ContractKind;
  const output: Record<string, unknown> = { ...record };
  output.schemaVersion = '2.0.0';
  output.id = map.get(String(record.id));
  output.lifecycle = STATE_MAP[String(record.state)];
  output.revision = kind === 'Evidence' ? 1 : record.version;
  output.updatedAt = kind === 'Evidence' ? record.createdAt : record.updatedAt;
  delete output.state;
  delete output.version;
  if (kind === 'TaskSeed') output.intentId = ref(record.intentId, map, '/intentId');
  if (kind === 'Acceptance') output.taskSeedId = ref(record.taskSeedId, map, '/taskSeedId');
  if (kind === 'PublishGate') {
    output.acceptanceId = ref(record.entityId, map, '/entityId');
    output.operation = 'publish';
    output.decision = record.finalDecision;
    delete output.entityId;
    delete output.action;
    delete output.finalDecision;
  }
  if (kind === 'Evidence') {
    output.stage = typeof record.stage === 'string' ? record.stage : 'execution';
    output.taskSeedId = ref(record.taskSeedId, map, '/taskSeedId');
    output.acceptanceId = ref(record.acceptanceId, map, '/acceptanceId');
    output.publishGateId = ref(record.publishGateId, map, '/publishGateId');
    output.baseCommit = hash(record.baseCommit, 'git');
    output.headCommit = hash(record.headCommit, 'git');
    output.inputHash = hash(record.inputHash, 'sha256');
    output.outputHash = hash(record.outputHash, 'sha256');
    const model = (record.model ?? {}) as Record<string, unknown>;
    output.model = { name: String(model.name ?? 'unknown'), version: String(model.version ?? 'unknown'), parametersHash: hash(model.parametersHash ?? 'unknown', 'sha256') };
    output.tools = Array.isArray(record.tools) ? record.tools.map((tool) => typeof tool === 'string' ? { name: tool } : tool) : [];
    const environment = (record.environment ?? {}) as Record<string, unknown>;
    output.environment = {
      os: String(environment.os ?? 'unknown'),
      runtime: String(environment.runtime ?? 'unknown'),
      containerImageDigest: hash(environment.containerImageDigest ?? 'unknown', 'sha256'),
      lockfileHash: hash(environment.lockfileHash ?? 'unknown', 'sha256'),
    };
    output.approvalsSnapshot = Array.isArray(record.approvalsSnapshot) ? record.approvalsSnapshot.map((item) => approval(item as Record<string, unknown>)) : undefined;
    output.diffHash = hash(record.diffHash, 'sha256');
  }
  if (Array.isArray(record.approvals)) output.approvals = record.approvals.map((item) => approval(item as Record<string, unknown>));
  return output;
}

export function migrateV1(inputPath: string, namespace: string, outputDirectory: string): MigrationReport {
  if (!namespace || /[\r\n]/.test(namespace)) fail('NAMESPACE_INVALID', '/namespace', 'Namespace must be a non-empty single line');
  if (!isAbsolute(outputDirectory)) fail('OUTPUT_PATH_NOT_ABSOLUTE', '/', 'Output directory must be absolute');
  if (existsSync(outputDirectory)) fail('OUTPUT_EXISTS', '/', 'Output directory already exists and will not be overwritten');
  const records = parseInput(inputPath);
  records.forEach((record, index) => validateV1(record, index));
  const idMap = new Map<string, string>();
  const reverseMap = new Map<string, string>();
  for (const record of records) {
    const oldId = String(record.id);
    const newId = createDeterministicContractId(record.kind as ContractKind, String(record.createdAt) + namespace + String(record.kind) + oldId, String(record.createdAt));
    if (idMap.has(oldId) || reverseMap.has(newId)) fail('ID_COLLISION', '/id', 'ID collision during migration');
    idMap.set(oldId, newId);
    reverseMap.set(newId, oldId);
  }
  const contracts = records.map((record) => transform(record, idMap));
  const parsed: Contract[] = [];
  for (const [index, contract] of contracts.entries()) {
    const result = safeParseContract(contract);
    if (!result.success) throw new ProtocolException('Migrated contract failed v2 validation', result.errors.map((error) => ({ ...error, path: '/contracts/' + index + error.path })));
    parsed.push(result.data);
  }
  const graph = validateContractGraph(parsed);
  if (!graph.valid) throw new ProtocolException('Migrated contract graph has unresolved references', graph.errors);
  const temporary = outputDirectory + '.tmp-' + createHash('sha256').update(inputPath + namespace).digest('hex').slice(0, 12);
  if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
  mkdirSync(temporary, { recursive: true });
  try {
    writeFileSync(join(temporary, 'contracts.v2.jsonl'), parsed.map((contract) => JSON.stringify(contract)).join('\n') + '\n', 'utf8');
    writeFileSync(join(temporary, 'id-map.json'), JSON.stringify(Object.fromEntries(idMap), null, 2) + '\n', 'utf8');
    const report: MigrationReport = {
      success: true, schemaVersion: '2.0.0', namespace, inputPath,
      contractCount: parsed.length, migratedAt: new Date().toISOString(),
    };
    writeFileSync(join(temporary, 'migration-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    mkdirSync(dirname(outputDirectory), { recursive: true });
    renameSync(temporary, outputDirectory);
    return report;
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}
