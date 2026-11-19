import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';

// What every action answers with: an error as a value, never thrown to the
// form that called it.
export type ActionResult = { error?: string; success?: boolean };

// How long each of auth's rate limits in nhost/nhost.toml holds a visitor back.
// Auth answers a 429 with an empty body, so the caller names the limit its
// request counts against.
export const RETRY_IN = {
  // global: every request
  request: 'a minute',
  // bruteForce and signups: sign-in, verify and sign-up requests
  signIn: '5 minutes',
  // emails: requests that send an email
  email: 'an hour',
} as const;

export type RetryIn = (typeof RETRY_IN)[keyof typeof RETRY_IN];

export function errorMessage(
  err: unknown,
  retryIn: RetryIn = RETRY_IN.request,
): string {
  const { status, message } = err as FetchError<ErrorResponse>;
  return status === 429
    ? `Too many attempts. Try again in ${retryIn}.`
    : message;
}

export const SIGNED_OUT = 'You are signed out. Sign in and try again.';

export const NETWORK_ERROR = 'The request did not reach the server. Try again.';
