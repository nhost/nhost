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

export const AUTH_UNAVAILABLE =
  'Could not check your session with the auth service. Try again.';

export const NETWORK_ERROR = 'The request did not reach the server. Try again.';

// The `error` the app puts on a link it could not sign in with, shown as the
// auth service's own codes are.
export const LINK_ERROR = {
  // Auth verified the address before redirecting, so only the sign-in failed.
  emailVerified: 'link-email-verified',
  unusable: 'link-unusable',
} as const;

export const LINK_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  [LINK_ERROR.emailVerified, 'Your email address is verified. Sign in.'],
  [
    LINK_ERROR.unusable,
    'This link could not sign you in here. Open it on the device that asked for it, or request a new one.',
  ],
]);
