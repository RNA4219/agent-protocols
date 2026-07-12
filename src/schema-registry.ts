import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContractKind } from './generated/contracts.js';

const SCHEMA_DIR = new URL('../schemas/v2/', import.meta.url);
const CONTRACT_KINDS: ContractKind[] = ['IntentContract', 'TaskSeed', 'Acceptance', 'PublishGate', 'Evidence'];

type Validator = { (data: unknown): boolean; errors?: unknown[] | null };
type AjvLike = { addSchema(schema: unknown): void; getSchema(id: string): Validator | undefined };
type AjvConstructor = new (options: Record<string, unknown>) => AjvLike;

function readSchema(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(fileURLToPath(new URL(name, SCHEMA_DIR)), 'utf8')) as Record<string, unknown>;
}

let registry: { ajv: AjvLike; contracts: Map<ContractKind, Validator>; event: Validator } | undefined;

export function getSchemaRegistry() {
  if (registry) return registry;
  const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
  const addFormats = addFormatsModule as unknown as (ajv: AjvLike) => void;
  const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: true });
  addFormats(ajv);
  ajv.addSchema(readSchema('common.schema.json'));
  for (const kind of CONTRACT_KINDS) ajv.addSchema(readSchema(kind + '.schema.json'));
  ajv.addSchema(readSchema('CloudEvent.schema.json'));
  const contracts = new Map<ContractKind, Validator>();
  for (const kind of CONTRACT_KINDS) {
    const validator = ajv.getSchema('https://agent-protocols.rna4219.dev/schemas/v2/' + kind + '.schema.json');
    if (!validator) throw new Error('Missing validator for ' + kind);
    contracts.set(kind, validator);
  }
  const event = ajv.getSchema('https://agent-protocols.rna4219.dev/schemas/v2/CloudEvent.schema.json');
  if (!event) throw new Error('Missing CloudEvent validator');
  registry = { ajv, contracts, event };
  return registry;
}
