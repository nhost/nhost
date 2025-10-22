import { type ErrorResponse } from './generated/schemas';

export type HasuraError = Error & ErrorResponse;

export interface MetadataOperationOptions {
  appUrl: string;
  adminSecret: string;
}
