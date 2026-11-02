import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
} from '@/app/auth/password/requirements';

const labels = (password: string, confirm?: string): string[] =>
  passwordRequirements(password, confirm).map((rule) => rule.label);

const _met = (password: string, confirm?: string): boolean[] =>
  passwordRequirements(password, confirm).map((rule) => rule.met);

describe('passwordRequirements', () => {
  it('adds the match rule only for a form that asks twice', () => {
    expect(labels('secret')).toHaveLength(1);
    expect(labels('secret', '')).toEqual([
      `At least ${PASSWORD_MIN_LENGTH} characters`,
      'Both entries match',
    ]);
  });
});
