// @vitest-environment happy-dom
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut } from '@/lib/nhost/actions';
import { nhost } from '@/lib/nhost/client';

// The SDK reads `fetch` when the client is built, at import.
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', mock);
  return mock;
});

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const jwt = (lifetimeSeconds: number): string =>
  [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      sub: 'user-id',
      exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
    }),
    'signature',
  ].join('.');

// Inside the SDK's 60 second margin, so the next request refreshes first.
const expiring: StoredSession = {
  accessToken: jwt(30),
  accessTokenExpiresIn: 30,
  refreshToken: 'old-refresh-token',
  refreshTokenId: 'refresh-token-id',
  decodedToken: { exp: Date.now() + 30 * 1000 },
  user: { id: 'user-id' } as StoredSession['user'],
};

const requests = (): { path: string; body: unknown }[] =>
  fetchMock.mock.calls.map(([url, init]) => ({
    path: new URL(String(url)).pathname,
    body: JSON.parse(String(init?.body)),
  }));

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
});

describe('signOut', () => {
  it('revokes the refresh token the SDK rotated before signing out', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, JSON.stringify(expiring));
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/token')
        ? json(
            {
              accessToken: jwt(900),
              accessTokenExpiresIn: 900,
              refreshToken: 'new-refresh-token',
              refreshTokenId: 'refresh-token-id',
              user: { id: 'user-id' },
            },
            200,
          )
        : json('OK', 200),
    );

    expect(await signOut()).toEqual({});

    expect(requests()).toEqual([
      { path: '/v1/token', body: { refreshToken: 'old-refresh-token' } },
      { path: '/v1/signout', body: { refreshToken: 'new-refresh-token' } },
    ]);
    expect(nhost.getUserSession()).toBeNull();
  });
});
