import type { ErrorResponse } from './generated/schemas';

export type HasuraError = Error & ErrorResponse;

export interface MetadataOperationOptions {
  appUrl: string;
  adminSecret: string;
}

export interface MigrationOperationOptions {
  appUrl: string;
  adminSecret: string;
}

export type ColumnValue = string | number | boolean;
