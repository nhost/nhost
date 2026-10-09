import { describe, expect, it } from 'vitest';
import { DEFAULT_INTENT, signInIntent } from '@/app/signin/intent';

describe('signInIntent', () => {
  it('signs up by default', () => {
    expect(DEFAULT_INTENT).toBe('sign-up');
    expect(signInIntent(undefined)).toBe('sign-up');
    expect(signInIntent('')).toBe('sign-up');
  });

  it('reads both intents', () => {
    expect(signInIntent('sign-in')).toBe('sign-in');
    expect(signInIntent('sign-up')).toBe('sign-up');
  });

  it('takes the first value when the parameter is repeated', () => {
    expect(signInIntent(['sign-in', 'sign-up'])).toBe('sign-in');
    expect(signInIntent(['sign-up', 'sign-in'])).toBe('sign-up');
  });

  it('falls back on anything else', () => {
    for (const crafted of ['SIGN-IN', 'sign-in ', 'admin']) {
      expect(signInIntent(crafted)).toBe(DEFAULT_INTENT);
    }
  });
});
