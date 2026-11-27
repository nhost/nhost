// @vitest-environment happy-dom
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkSession,
  getVerifiedUser,
  nhost,
  revokeLinkToken,
  updateSessionUser,
} from '@/lib/nhost/client';

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

// Far enough from expiry that nothing refreshes.
const live: StoredSession = {
  accessToken: jwt(900),
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh-token',
  refreshTokenId: 'refresh-token-id',
  decodedToken: { exp: Date.now() + 900 * 1000 },
  user: { id: 'user-id', displayName: 'Ada' } as StoredSession['user'],
};

const store = (session: object): void =>
  localStorage.setItem(DEFAULT_SESSION_KEY, JSON.stringify(session));

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getVerifiedUser', () => {
  // A session the visitor wrote themselves: an expiry an hour out, so nothing
  // tries to refresh it, and somebody else's user.
  it('rejects a stored session with a forged expiry', async () => {
    store({
      accessToken: 'not-a-jwt',
      refreshToken: '00000000-0000-0000-0000-000000000000',
      decodedToken: { exp: Date.now() + 60 * 60 * 1000 },
      user: { id: 'victim-id', email: 'admin@example.com' },
    });
    fetchMock.mockResolvedValue(
      json({ error: 'invalid-token', message: 'Invalid token' }, 401),
    );

    expect(await getVerifiedUser()).toEqual({ user: null, reason: 'rejected' });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/user$/);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization'),
    ).toBe('Bearer not-a-jwt');
  });

  // An outage is not a reason to sign anyone out.
  it('tells a failure to answer apart from a refusal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store(live);
    fetchMock.mockResolvedValue(json({ error: 'internal' }, 500));

    expect(await getVerifiedUser()).toEqual({
      user: null,
      reason: 'unavailable',
    });
  });

  it('asks nothing without a session', async () => {
    expect(await getVerifiedUser()).toEqual({
      user: null,
      reason: 'signed-out',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// An access token stays valid for its whole life after the session is
// revoked, so the app asks whether the refresh token's row is still there.
describe('checkSession', () => {
  const graphqlBody = (): { variables: object } =>
    JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

  it('calls a session whose row is gone revoked', async () => {
    store(live);
    fetchMock.mockResolvedValue(
      json({ data: { authRefreshToken: null } }, 200),
    );

    expect(await checkSession(live)).toBe('revoked');
    expect(graphqlBody().variables).toEqual({ id: 'refresh-token-id' });
  });

  it('calls a session it cannot check unknown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store(live);

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await checkSession(live)).toBe('unknown');

    fetchMock.mockResolvedValueOnce(
      json({ errors: [{ message: 'field not found in type' }] }, 200),
    );
    expect(await checkSession(live)).toBe('unknown');

    expect(await checkSession({ ...live, refreshTokenId: '' })).toBe('unknown');
  });
});

describe('revokeLinkToken', () => {
  // The main client would clear the visitor's own session on any /signout.
  it('signs the link out and leaves the stored session alone', async () => {
    store(live);
    fetchMock.mockResolvedValue(json('OK', 200));

    await revokeLinkToken('link-token');

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/signout$/);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      refreshToken: 'link-token',
    });
    expect(nhost.getUserSession()?.refreshToken).toBe('refresh-token');
  });
});

describe('updateSessionUser', () => {
  it('rewrites the stored user and nothing else', () => {
    store(live);

    updateSessionUser({ displayName: 'Grace' });

    expect(nhost.getUserSession()).toMatchObject({
      refreshToken: 'refresh-token',
      user: { id: 'user-id', displayName: 'Grace' },
    });
  });
});
