import { describe, expect, it } from 'vitest';
import { linkToken } from '@/lib/nhost/linkToken';

// The shapes a deep link actually arrives in. Under Expo Go it is the
// development server's URL with a `--` separator; in a real build it is the
// app's own scheme. Neither is something a URL parser reads the same way on
// both platforms, which is why the query is taken by hand.
describe('linkToken', () => {
  it('reads the token from a custom scheme link', () => {
    expect(linkToken('nhoststarter:///auth/callback?refreshToken=abc123')).toBe(
      'abc123',
    );
  });

  it('reads the token from an Expo Go link', () => {
    expect(
      linkToken('exp://10.0.0.2:8081/--/protected?refreshToken=abc123'),
    ).toBe('abc123');
  });

  it('finds it among other parameters', () => {
    expect(
      linkToken('nhoststarter:///?type=signin&refreshToken=abc123&x=1'),
    ).toBe('abc123');
  });

  it('is null for a link that carries no token', () => {
    expect(linkToken('nhoststarter:///protected')).toBeNull();
    expect(linkToken('nhoststarter:///protected?next=%2Fhome')).toBeNull();
    expect(linkToken('')).toBeNull();
  });
});
