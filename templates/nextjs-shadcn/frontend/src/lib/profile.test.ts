import { describe, expect, it } from 'vitest';
import { isProfilePublic } from '@/lib/profile';

// The default is the feature. A scaffolded project should have a working
// public page the moment somebody signs in, so every shape that is not an
// explicit opt-out has to read as public - including the JSON `null` Nhost
// auth writes for an account that was never given any metadata.
describe('isProfilePublic', () => {
  it('is public for an account that has never set anything', () => {
    expect(isProfilePublic(null)).toBe(true);
    expect(isProfilePublic(undefined)).toBe(true);
    expect(isProfilePublic({})).toBe(true);
  });

  it('is public when other metadata is present but the flag is not', () => {
    expect(isProfilePublic({ deletedAt: '2026-01-01T00:00:00Z' })).toBe(true);
  });

  it('is private only when explicitly turned off', () => {
    expect(isProfilePublic({ publicProfile: false })).toBe(false);
  });

  it('is public when explicitly turned on', () => {
    expect(isProfilePublic({ publicProfile: true })).toBe(true);
  });

  // Only the exact boolean turns it off. Anything else is a value this app did
  // not write, and guessing that it meant "private" would take somebody's page
  // down on a typo in a column they share with the soft-delete flow.
  it('ignores values that are not the boolean false', () => {
    expect(isProfilePublic({ publicProfile: 'false' })).toBe(true);
    expect(isProfilePublic({ publicProfile: 0 })).toBe(true);
    expect(isProfilePublic({ publicProfile: null })).toBe(true);
  });

  // `metadata` is a jsonb column, so it can hold a scalar or an array if
  // something outside this app writes one. None of those is an opt-out.
  it('treats a non-object column value as public', () => {
    expect(isProfilePublic('nonsense')).toBe(true);
    expect(isProfilePublic(42)).toBe(true);
    expect(isProfilePublic([{ publicProfile: false }])).toBe(true);
  });
});
