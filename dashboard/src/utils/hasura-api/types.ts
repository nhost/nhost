import { type ErrorResponse } from './generated/schemas';

export type HasuraError = Error & ErrorResponse;
