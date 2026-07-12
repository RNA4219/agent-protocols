import type { ProtocolError } from './validation-types.js';

export class ProtocolException extends Error {
  readonly errors: ProtocolError[];

  constructor(message: string, errors: ProtocolError[] = []) {
    super(message);
    this.name = 'ProtocolException';
    this.errors = errors;
  }
}

export function protocolError(
  code: string,
  path: string,
  message: string,
  source: ProtocolError['source'],
): ProtocolError {
  return { code, path, message, source };
}
