import { describe, expect, it } from 'vitest';
import { isSafeInternalRedirect } from '@/lib/redirect';

describe('isSafeInternalRedirect', () => {
  it('accepts internal paths', () => {
    expect(isSafeInternalRedirect('/protected')).toBe(true);
    expect(isSafeInternalRedirect('/protected?tab=todos')).toBe(true);
  });

  it('rejects targets that leave the app', () => {
    expect(isSafeInternalRedirect('//evil.example.com')).toBe(false);
    expect(isSafeInternalRedirect('/\\evil.example.com')).toBe(false);
    expect(isSafeInternalRedirect('https://evil.example.com')).toBe(false);
    expect(isSafeInternalRedirect('protected')).toBe(false);
  });
});
