import type { StoredSession } from '@nhost/nhost-js/session';

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** An unsigned JWT for `claims`, built at runtime so no token sits in source. */
export function jwt(lifetimeSeconds: number, claims: object = {}): string {
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      sub: 'user-id',
      exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
      ...claims,
    }),
    'signature',
  ].join('.');
}

/** A session far enough from expiry that nothing refreshes it. */
export function liveSession(overrides: Partial<StoredSession> = {}) {
  return {
    accessToken: jwt(900),
    accessTokenExpiresIn: 900,
    refreshToken: 'refresh-token',
    refreshTokenId: 'refresh-token-id',
    decodedToken: { exp: Date.now() + 900 * 1000 },
    user: { id: 'user-id', displayName: 'Ada' } as StoredSession['user'],
    ...overrides,
  } as StoredSession;
}

export const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
