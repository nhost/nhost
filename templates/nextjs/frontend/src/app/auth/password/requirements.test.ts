import { describe, expect, it } from 'vitest';
import {
  meetsRequirements,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
} from '@/app/auth/password/requirements';

const labels = (password: string, confirm?: string): string[] =>
  passwordRequirements(password, confirm).map((rule) => rule.label);

describe('passwordRequirements', () => {
  it('adds the match rule only for a form that asks twice', () => {
    expect(labels('secret')).toHaveLength(1);
    expect(labels('secret', '')).toEqual([
      `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
      'Both entries match',
    ]);
  });

  it('refuses a password longer than auth accepts', () => {
    const longest = 'a'.repeat(PASSWORD_MAX_LENGTH);
    expect(meetsRequirements(longest, longest)).toBe(true);
    expect(meetsRequirements(`${longest}a`, `${longest}a`)).toBe(false);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(meetsRequirements('🔑'.repeat(PASSWORD_MAX_LENGTH))).toBe(true);
  });
});
