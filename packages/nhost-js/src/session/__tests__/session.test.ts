import { describe, expect, it } from '@jest/globals';
import { decodeUserSession } from '../session';

/**
 * Encodes a string to base64url (RFC 4648 Section 5), using only vanilla JS APIs.
 */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(bytes, (b) => String.fromCharCode(b)).join(
    '',
  );
  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Creates a fake JWT token with the given payload, using base64url encoding
 * (as per the JWT specification, RFC 7519 / RFC 4648 Section 5).
 */
function createJWT(payload: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url('fake-signature');
  return `${header}.${body}.${signature}`;
}

describe('decodeUserSession', () => {
  it('should decode a standard JWT token', () => {
    const payload = {
      sub: 'user-123',
      iat: 1700000000,
      exp: 1700003600,
      iss: 'nhost',
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': 'user-123',
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': '{user,admin}',
      },
    };

    const token = createJWT(payload);
    const decoded = decodeUserSession(token);

    expect(decoded.sub).toBe('user-123');
    expect(decoded.iss).toBe('nhost');
    expect(decoded.iat).toBe(1700000000 * 1000);
    expect(decoded.exp).toBe(1700003600 * 1000);

    const claims = decoded['https://hasura.io/jwt/claims'] as Record<
      string,
      unknown
    >;
    expect(claims['x-hasura-user-id']).toBe('user-123');
    expect(claims['x-hasura-default-role']).toBe('user');
    expect(claims['x-hasura-allowed-roles']).toEqual(['user', 'admin']);
  });

  it('should decode a JWT whose base64url payload contains - and _ characters (issue #3890)', () => {
    // This payload mimics a real-world scenario: a Google OAuth user with an avatar URL.
    // The avatar URL and other claim values cause the base64url-encoded payload to
    // contain `-` and `_` characters, which are valid in base64url (RFC 4648 Section 5)
    // but NOT valid in standard base64 (which uses `+` and `/` instead).
    // The browser's native atob() only supports standard base64, so passing
    // base64url directly to atob() throws InvalidCharacterError.
    const payload = {
      sub: 'f5765cb0-5b62-4fc0-b1a5-3e8e12345678',
      iat: 1700000000,
      exp: 1700003600,
      iss: 'nhost',
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': 'f5765cb0-5b62-4fc0-b1a5-3e8e12345678',
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': '{user}',
        'x-hasura-avatar-url':
          'https://lh3.googleusercontent.com/a/ACg8ocLv_IKZLRBq7-xKP3BxhGvJnQzXYs96?sz=200',
      },
    };

    const token = createJWT(payload);
    const encodedPayload = token.split('.')[1] as string;

    // Precondition: verify the base64url-encoded payload actually contains
    // the problematic characters that trigger the bug.
    expect(encodedPayload.includes('-') || encodedPayload.includes('_')).toBe(
      true,
    );

    // This call should succeed but currently throws InvalidCharacterError
    // in browser environments (and in Node.js 16+ where atob is globally available)
    // because atob() does not support base64url encoding.
    const decoded = decodeUserSession(token);

    expect(decoded.sub).toBe('f5765cb0-5b62-4fc0-b1a5-3e8e12345678');
    expect(decoded.iat).toBe(1700000000 * 1000);
    expect(decoded.exp).toBe(1700003600 * 1000);

    const claims = decoded['https://hasura.io/jwt/claims'] as Record<
      string,
      unknown
    >;
    expect(claims['x-hasura-avatar-url']).toBe(
      'https://lh3.googleusercontent.com/a/ACg8ocLv_IKZLRBq7-xKP3BxhGvJnQzXYs96?sz=200',
    );
  });

  it('should throw on invalid token format', () => {
    expect(() => decodeUserSession('not-a-jwt')).toThrow(
      'Invalid access token format',
    );
    expect(() => decodeUserSession('only.two')).toThrow(
      'Invalid access token format',
    );
    expect(() => decodeUserSession('')).toThrow('Invalid access token format');
  });
});
