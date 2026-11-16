import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  couldBeAPassword,
  meetsRequirements,
  newPasswordError,
  newPasswordProblem,
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
} from '@/app/auth/password/requirements';

const labels = (password: string, confirm?: string): string[] =>
  passwordRequirements(password, confirm).map((rule) => rule.label);

const LENGTH = `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`;
const BYTES = 'Fewer accented letters, symbols or emoji';

// Two bytes of UTF-8 each, so the byte cap comes before the character cap.
const accented = (count: number): string => 'é'.repeat(count);

describe('passwordRequirements', () => {
  it('adds the match rule only for a form that asks twice', () => {
    expect(labels('secret')).toEqual([LENGTH]);
    expect(labels('secret', '')).toEqual([LENGTH, 'Both entries match']);
  });

  it('adds the byte rule only once the password has more than ASCII', () => {
    expect(labels('a'.repeat(PASSWORD_MAX_LENGTH))).toEqual([LENGTH]);
    expect(labels('pässword1')).toEqual([LENGTH, BYTES]);
  });
});

describe('the rules a new password has to meet', () => {
  it.each([
    ['one short of the minimum', 'a'.repeat(PASSWORD_MIN_LENGTH - 1), false],
    ['the minimum', 'a'.repeat(PASSWORD_MIN_LENGTH), true],
    ['the maximum', 'a'.repeat(PASSWORD_MAX_LENGTH), true],
    ['one over the maximum', 'a'.repeat(PASSWORD_MAX_LENGTH + 1), false],
    [
      'emoji counted as one character each',
      '🔑'.repeat(PASSWORD_MIN_LENGTH),
      true,
    ],
    ['the most bytes bcrypt takes', accented(PASSWORD_MAX_BYTES / 2), true],
    ['a byte over, in fewer than 50 characters', accented(37), false],
    ['four-byte emoji over the byte cap', '🔑'.repeat(19), false],
  ])('%s', (_, password, ok) => {
    expect(meetsRequirements(password, password)).toBe(ok);
    expect(newPasswordProblem(password) === undefined).toBe(ok);
  });

  it('wants both entries to match, and not both empty', () => {
    expect(meetsRequirements('correct horse', 'correct horsE')).toBe(false);
    expect(meetsRequirements('', '')).toBe(false);
  });

  it('says which rule a refused password broke', () => {
    expect(newPasswordProblem('short')).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
    expect(newPasswordProblem('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
    );
    expect(newPasswordProblem(accented(37))).toBe(
      'Use fewer accented letters, symbols or emoji.',
    );
  });

  it('matches the minimum the backend enforces', () => {
    const toml = readFileSync(
      fileURLToPath(
        new URL('../../../../../nhost/nhost.toml', import.meta.url),
      ),
      'utf8',
    );

    expect(toml.match(/^passwordMinLength = (\d+)$/m)?.[1]).toBe(
      String(PASSWORD_MIN_LENGTH),
    );
  });
});

describe('couldBeAPassword', () => {
  it('passes only what auth sign-in accepts', () => {
    expect(couldBeAPassword('ab')).toBe(false);
    expect(couldBeAPassword('abc')).toBe(true);
    expect(couldBeAPassword('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true);
    expect(couldBeAPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('newPasswordError', () => {
  const refused = (error: string, message = 'raw') =>
    Object.assign(new Error(message), { body: { error, message } });

  it('puts the password refusals in words', () => {
    expect(newPasswordError(refused('password-in-hibp-database'))).toBe(
      'This password has appeared in a data breach. Choose another.',
    );
    expect(newPasswordError(refused('password-too-short'))).toBe(
      'The backend wants a longer password than this app asks for.',
    );
  });

  it("passes anything else through as auth's message", () => {
    expect(newPasswordError(refused('internal-server-error', 'boom'))).toBe(
      'boom',
    );
  });
});
