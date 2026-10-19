import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
} from '@/app/auth/password/requirements';

const labels = (password: string, confirm?: string): string[] =>
  passwordRequirements(password, confirm).map((rule) => rule.label);

const met = (password: string, confirm?: string): boolean[] =>
  passwordRequirements(password, confirm).map((rule) => rule.met);

describe('passwordRequirements', () => {
  // The number is the form's copy of `passwordMinLength` in nhost.toml, so
  // the rule the visitor reads is the one the auth service will apply.
  it('names the length the backend is configured to want', () => {
    expect(labels('')[0]).toBe(`At least ${PASSWORD_MIN_LENGTH} characters`);
  });

  it('meets the length rule at exactly the minimum', () => {
    expect(met('a'.repeat(PASSWORD_MIN_LENGTH - 1))[0]).toBe(false);
    expect(met('a'.repeat(PASSWORD_MIN_LENGTH))[0]).toBe(true);
  });

  // Length is the whole policy: the auth service has no rule about case,
  // digits or symbols, so neither does this.
  it('asks for nothing but length when there is no second field', () => {
    expect(labels('a'.repeat(PASSWORD_MIN_LENGTH))).toHaveLength(1);
    expect(met('aaaaaaaaaaaa')).toEqual([true]);
  });

  it('adds the match rule only for a form that asks twice', () => {
    expect(labels('secret')).toHaveLength(1);
    expect(labels('secret', '')).toEqual([
      `At least ${PASSWORD_MIN_LENGTH} characters`,
      'Both entries match',
    ]);
  });

  it('ticks the match rule when the two are the same', () => {
    expect(met('correct horse', 'correct horse')[1]).toBe(true);
    expect(met('correct horse', 'correct horsf')[1]).toBe(false);
  });

  // Two empty fields are equal, which is not an achievement worth ticking.
  it('does not call two empty fields a match', () => {
    expect(met('', '')[1]).toBe(false);
  });
});
