import { DEFAULT_INTENT, signInIntent } from '@/screens/signin/intent';

describe('signInIntent', () => {
  it('reads sign-in, and anything else as the default', () => {
    expect(signInIntent('sign-in')).toBe('sign-in');
    expect(signInIntent(['sign-in', 'sign-up'])).toBe('sign-in');
    for (const value of ['sign-up', 'other', undefined, []]) {
      expect(signInIntent(value)).toBe(DEFAULT_INTENT);
    }
  });
});
