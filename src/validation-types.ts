import type { Contract } from './generated/contracts.js';

export type ErrorSource = 'schema' | 'semantic' | 'reference';

export interface ProtocolError {
  code: string;
  path: string;
  message: string;
  source: ErrorSource;
}

export type SafeParseSuccess<T> = { success: true; data: T; errors?: never };
export type SafeParseFailure = { success: false; data?: never; errors: ProtocolError[] };
export type SafeResult<T> = SafeParseSuccess<T> | SafeParseFailure;

export interface ValidationSummary {
  valid: boolean;
  success: boolean;
  errors: ProtocolError[];
}

export type ContractLike = Contract;
