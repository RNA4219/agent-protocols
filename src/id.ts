import { createHash, randomBytes } from 'node:crypto';
import type { ContractKind } from './generated/contracts.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KIND_NAMES: ContractKind[] = ['IntentContract', 'TaskSeed', 'Acceptance', 'PublishGate', 'Evidence'];

function timestampPart(timestampMs: number): string {
  let value = BigInt(timestampMs);
  let output = '';
  for (let index = 0; index < 10; index += 1) {
    output = ALPHABET[Number(value & 31n)] + output;
    value >>= 5n;
  }
  return output;
}

function randomPart(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let output = '';
  for (let index = 0; index < 16; index += 1) {
    output = ALPHABET[Number(value & 31n)] + output;
    value >>= 5n;
  }
  return output;
}

function asDate(value: Date | string | number | undefined): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid ULID timestamp');
  return date;
}

export function formatUtc(value: Date | string | number): string {
  return asDate(value).toISOString();
}

export interface ContractIdOptions {
  now?: Date | string | number;
  random?: Uint8Array;
}

export function createContractId(kind: ContractKind, options: ContractIdOptions = {}): string {
  if (!KIND_NAMES.includes(kind)) throw new Error('Unknown contract kind: ' + String(kind));
  const date = asDate(options.now);
  const bytes = options.random ?? randomBytes(10);
  if (bytes.length !== 10) throw new Error('ULID random component must be 10 bytes');
  return kind + '_' + timestampPart(date.getTime()) + randomPart(bytes);
}

export function createDeterministicContractId(kind: ContractKind, key: string, createdAt: string): string {
  const digest = createHash('sha256').update(key, 'utf8').digest();
  return createContractId(kind, { now: createdAt, random: digest.subarray(0, 10) });
}

export function isContractIdForKind(value: unknown, kind: ContractKind): value is string {
  return typeof value === 'string' && new RegExp('^' + kind + '_[0-9A-HJKMNP-TV-Z]{26}$').test(value);
}
