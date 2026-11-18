import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { errorMessage } from '@/lib/nhost/errors';

// What the password forms check while you type. Equal to `passwordMinLength`
// in nhost/nhost.toml, and a test keeps it that way.
export const PASSWORD_MIN_LENGTH = 9;
// Auth's API refuses a longer one with a bare `schema-validation-error`.
export const PASSWORD_MAX_LENGTH = 50;
// Auth hashes with bcrypt, which refuses more than 72 bytes of UTF-8. Only a
// password with accented letters, symbols or emoji can get there in 50
// characters.
export const PASSWORD_MAX_BYTES = 72;
// What auth's sign-in accepts. Anything else cannot be anyone's password.
const SIGN_IN_MIN_LENGTH = 3;

export type Requirement = { label: string; met: boolean };

// Auth counts code points, not the UTF-16 units `length` counts.
const characters = (password: string): number => [...password].length;

const bytes = (password: string): number =>
  new TextEncoder().encode(password).length;

/** The rules, each with whether `password` meets it yet. */
export function passwordRequirements(
  password: string,
  confirm?: string,
): Requirement[] {
  const length = characters(password);
  const rules: Requirement[] = [
    {
      label: `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
      met: length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH,
    },
  ];

  // Plain ASCII is a byte a character, so it cannot break this one.
  const size = bytes(password);
  if (size !== password.length) {
    rules.push({
      label: 'Fewer accented letters, symbols or emoji',
      met: size <= PASSWORD_MAX_BYTES,
    });
  }

  if (confirm !== undefined) {
    rules.push({
      label: 'Both entries match',
      // Two empty fields match, which is not an achievement worth ticking.
      met: password.length > 0 && password === confirm,
    });
  }

  return rules;
}

/** Whether `password` meets every rule, so the form can be sent. */
export const meetsRequirements = (password: string, confirm?: string) =>
  passwordRequirements(password, confirm).every((rule) => rule.met);

/**
 * Why auth would refuse `password` as a new one, checked before asking it:
 * the actions take whatever their caller sends, not only what a form allowed.
 */
export function newPasswordProblem(password: string): string | undefined {
  const length = characters(password);
  if (length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (bytes(password) > PASSWORD_MAX_BYTES) {
    return 'Use fewer accented letters, symbols or emoji.';
  }
  return undefined;
}

/** Whether auth's sign-in would even look `password` up. */
export const couldBeAPassword = (password: string): boolean => {
  const length = characters(password);
  return length >= SIGN_IN_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
};

/** Auth's answer to a new password, in words. */
export function newPasswordError(err: unknown): string {
  switch ((err as FetchError<ErrorResponse>).body?.error) {
    case 'password-in-hibp-database':
      return 'This password has appeared in a data breach. Choose another.';
    case 'password-too-short':
      return 'The backend wants a longer password than this app asks for.';
    default:
      return errorMessage(err);
  }
}
