import { beforeEach, describe, expect, test } from '@jest/globals';
import type { Session } from '../../auth';
import { SessionStorage } from '../../session/storage';
import { MemoryStorage } from '../../session/storageBackend';
import { updateSessionFromResponseMiddleware } from '../middlewareUpdateSessionFromResponse';

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

const userId = 'db477732-48fa-4289-b694-2886a646b6eb';

// The middleware hands the session to SessionStorage.set(), which decodes the
// access token; a structurally valid JWT (not just any string) is required for
// the session to actually be persisted.
const accessToken = createJWT({
  sub: userId,
  iat: 1700000000,
  exp: 1700000900,
  iss: 'hasura-auth',
  'https://hasura.io/jwt/claims': {
    'x-hasura-user-id': userId,
    'x-hasura-default-role': 'user',
    'x-hasura-allowed-roles': '{user,me}',
    'x-hasura-auth-elevated': userId,
  },
});

const session: Session = {
  accessToken,
  accessTokenExpiresIn: 900,
  refreshTokenId: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
  refreshToken: 'a1b2c3d4-c4b9-48e3-978a-d4d0f1d42e24',
};

describe('updateSessionFromResponseMiddleware', () => {
  let storage: SessionStorage;

  beforeEach(() => {
    storage = new SessionStorage(new MemoryStorage());
  });

  const run = async (
    url: string,
    body: unknown,
    status = 200,
  ): Promise<Response> => {
    const next = () =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const middleware = updateSessionFromResponseMiddleware(storage);
    return middleware(next)(url, { method: 'POST' });
  };

  test('persists the elevated session returned by /elevate/totp', async () => {
    const response = await run(
      'https://local.auth.local.nhost.run/v1/elevate/totp',
      { session },
    );

    const stored = storage.get();
    expect(stored?.accessToken).toBe(accessToken);
    expect(stored?.refreshToken).toBe(session.refreshToken);

    const claims = stored?.decodedToken['https://hasura.io/jwt/claims'] as
      | Record<string, unknown>
      | undefined;
    expect(claims?.['x-hasura-auth-elevated']).toBe(userId);

    // The middleware must not consume the response body it inspects.
    const body = (await response.json()) as { session: Session };
    expect(body.session.accessToken).toBe(accessToken);
  });

  test('persists the elevated session returned by /elevate/webauthn/verify', async () => {
    await run('https://local.auth.local.nhost.run/v1/elevate/webauthn/verify', {
      session,
    });

    expect(storage.get()?.accessToken).toBe(accessToken);
  });

  test('persists the elevated session returned by /elevate/otp/email/verify', async () => {
    await run(
      'https://local.auth.local.nhost.run/v1/elevate/otp/email/verify',
      { session },
    );

    expect(storage.get()?.accessToken).toBe(accessToken);
  });

  test('stores nothing for the /elevate/webauthn challenge response', async () => {
    await run('https://local.auth.local.nhost.run/v1/elevate/webauthn', {
      publicKey: { challenge: 'a-challenge' },
    });

    expect(storage.get()).toBeNull();
  });

  test('stores nothing for the /elevate/otp/email OK response', async () => {
    await run('https://local.auth.local.nhost.run/v1/elevate/otp/email', 'OK');

    expect(storage.get()).toBeNull();
  });

  test('stores nothing for an error response from /elevate/totp', async () => {
    await run(
      'https://local.auth.local.nhost.run/v1/elevate/totp',
      { error: 'invalid-totp', message: 'Invalid TOTP code', status: 401 },
      401,
    );

    expect(storage.get()).toBeNull();
  });

  test('stores nothing for session-shaped bodies from unrelated endpoints', async () => {
    await run('https://local.auth.local.nhost.run/v1/user/mfa', { session });

    expect(storage.get()).toBeNull();
  });
});
