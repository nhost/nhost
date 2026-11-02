import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';

// What every server action answers with: an error as a value, never thrown to
// the client.
export type ActionResult = { error?: string; success?: boolean };

export function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

export const SIGNED_OUT = 'You are signed out. Sign in and try again.';

export const NETWORK_ERROR = 'The request did not reach the server. Try again.';
