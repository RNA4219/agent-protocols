import type { CloudEvent, Contract } from './generated/contracts.js';
import { createContractId, formatUtc } from './id.js';
import { safeParseContract, safeParseEvent } from './validation-v2.js';
import { ProtocolException } from './errors.js';
import type { Clock } from './policy.js';

export interface ContractEventOptions {
  source?: string;
  type?: string;
  subject?: string;
  correlationid?: string;
  causationid?: string;
  idempotencykey?: string;
  eventId?: string;
  clock?: Clock;
}

function clockDate(clock?: Clock): Date {
  const value = clock ? clock() : new Date();
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid event clock value');
  return date;
}

function eventId(contract: Contract, at: Date): string {
  const suffix = createContractId(contract.kind, { now: at }).split('_')[1];
  return 'event_' + suffix;
}

export function createContractEvent(contractInput: Contract, options: ContractEventOptions = {}): CloudEvent {
  const validation = safeParseContract(contractInput);
  if (!validation.success) throw new ProtocolException('Contract event data is invalid', validation.errors);
  const contract = validation.data;
  const at = clockDate(options.clock);
  const event: CloudEvent = {
    specversion: '1.0',
    id: options.eventId ?? eventId(contract, at),
    source: options.source ?? 'urn:rna4219:agent-protocols',
    type: options.type ?? 'com.rna4219.agent-protocols.' + contract.kind + '.v2',
    subject: options.subject ?? contract.id,
    time: formatUtc(at),
    datacontenttype: 'application/json',
    data: contract,
    correlationid: options.correlationid ?? contract.id,
    causationid: options.causationid ?? contract.id,
    idempotencykey: options.idempotencykey ?? contract.id + ':' + contract.revision,
    contractrevision: contract.revision,
  };
  const parsed = safeParseEvent(event);
  if (!parsed.success) throw new ProtocolException('Generated CloudEvent failed validation', parsed.errors);
  return parsed.data;
}
