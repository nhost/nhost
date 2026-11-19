import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FakeRequest,
  fakeEvent,
  isDeleted,
  type WrittenCookie,
} from '#lib/testing/requestEvent.ts';
import {
  createNhostClient,
  getVerifiedUser,
  handleNhostRequest,
  LINK_TOKEN_PARAM,
  PASSWORD_RESET_KEY,
  updateSessionUser,
} from './server.ts';

const current = vi.hoisted(() => ({ event: undefined as unknown }));

vi.mock('$app/server', () => ({ getRequestEvent: () => current.event }));

const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// The request every call below runs in, and what its response would send.
let written: Map<string, WrittenCookie>;
const inRequest = (request: FakeRequest = {}): RequestEvent => {
  const fake = fakeEvent(request);
  current.event = fake.event;
  written = fake.written;
  return fake.event;
};

const withSession = (session: string, request: FakeRequest = {}) =>
  inRequest({
    ...request,
    cookies: { [DEFAULT_SESSION_KEY]: session, ...request.cookies },
  });

const sessionCookie = (): Record<string, unknown> =>
  JSON.parse(written.get(DEFAULT_SESSION_KEY)?.value ?? 'null');

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A cookie the visitor wrote themselves: an expiry an hour out, so nothing
// tries to refresh it, and somebody else's user.
const forgedSession = JSON.stringify({
  accessToken: 'not-a-jwt',
  refreshToken: '00000000-0000-0000-0000-000000000000',
  decodedToken: { exp: Date.now() + 60 * 60 * 1000 },
  user: { id: 'victim-id', email: 'admin@example.com' },
});

const sentHeader = (call: number, name: string): string | null =>
  new Headers(fetchMock.mock.calls[call][1]?.headers).get(name);

describe('getVerifiedUser', () => {
  it('rejects a session cookie with a forged expiry', async () => {
    withSession(forgedSession);
    fetchMock.mockResolvedValue(
      json({ error: 'invalid-token', message: 'Invalid token' }, 401),
    );

    expect(await getVerifiedUser()).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/user$/);
    expect(sentHeader(0, 'Authorization')).toBe('Bearer not-a-jwt');
  });
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

const storedSession = (lifetimeSeconds: number): string =>
  JSON.stringify({
    accessToken: jwt(lifetimeSeconds),
    refreshToken: 'old-refresh-token',
    decodedToken: { exp: Date.now() + lifetimeSeconds * 1000 },
    user: { id: 'user-id' },
  });

const refreshed = (accessToken: string): Response =>
  json(
    {
      accessToken,
      accessTokenExpiresIn: 900,
      refreshToken: 'new-refresh-token',
      refreshTokenId: 'refresh-token-id',
      user: { id: 'user-id' },
    },
    200,
  );

describe('session cookie', () => {
  // Inside the hook's refresh margin, so every case below rotates it.
  const expiring = storedSession(30);

  it('keeps the refresh token in an httpOnly cookie', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    await handleNhostRequest(withSession(expiring));

    expect(sessionCookie()).toMatchObject({
      refreshToken: 'new-refresh-token',
    });
    expect(written.get(DEFAULT_SESSION_KEY)?.options).toMatchObject({
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  // They run alongside the page that asked for them, and a refresh token
  // works once.
  it('is read without a refresh by remote queries and API routes', async () => {
    for (const request of [
      { method: 'GET', isRemoteRequest: true },
      { url: 'http://localhost:3000/api/avatar/x' },
    ]) {
      const result = await handleNhostRequest(withSession(expiring, request));

      expect(result.session).toMatchObject({
        refreshToken: 'old-refresh-token',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is refreshed by remote commands', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    await handleNhostRequest(
      withSession(expiring, { method: 'POST', isRemoteRequest: true }),
    );

    expect(sessionCookie()).toMatchObject({
      refreshToken: 'new-refresh-token',
    });
  });
});

// A request that loses a race to rotate the refresh token is rejected like a
// revoked one, so only a second rejection of the same token, after a grace
// period for the winner's cookie to land, signs out.
describe('rejected refresh', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async () =>
      json({ error: 'invalid-refresh-token', message: 'Invalid' }, 401),
    );
  });

  const expired = JSON.stringify({
    ...JSON.parse(storedSession(-60)),
    refreshTokenId: 'refresh-token-id',
  });

  // Rejects the token once, then again `laterMs` on with the marker the first
  // response set.
  const rejectedTwice = async (laterMs: number) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await handleNhostRequest(withSession(expired));
    const marker = written.get('nhostRefreshRejected')?.value ?? '';

    vi.setSystemTime(Date.now() + laterMs);
    await handleNhostRequest(
      withSession(expired, { cookies: { nhostRefreshRejected: marker } }),
    );
  };

  it('keeps the cookies and marks the token the first time', async () => {
    const event = withSession(expired);
    const result = await handleNhostRequest(event);

    expect(result.session).toBeNull();
    expect(createNhostClient(event).getUserSession()).toBeNull();
    expect(written.has(DEFAULT_SESSION_KEY)).toBe(false);
    expect(written.get('nhostRefreshRejected')?.value).toMatch(
      /^refresh-token-id\.\d+$/,
    );
    expect(written.get('nhostRefreshRejected')?.options).toMatchObject({
      httpOnly: true,
    });
  });

  it('keeps the cookies and the marker when rejected again within the grace period', async () => {
    await rejectedTwice(1000);

    expect([...written.keys()]).toEqual([]);
  });

  it('deletes the cookies when the marked token is rejected again later', async () => {
    await rejectedTwice(5000);

    for (const name of [
      DEFAULT_SESSION_KEY,
      PASSWORD_RESET_KEY,
      'nhostRefreshRejected',
    ]) {
      expect(isDeleted(written.get(name))).toBe(true);
    }
  });
});

describe('link redemption', () => {
  const linkUrl = `http://localhost:3000/?${LINK_TOKEN_PARAM}=link-token`;

  it('redeems the link over a session the auth service rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (_, init) =>
      String(init?.body).includes('link-token')
        ? refreshed(jwt(900))
        : json({ error: 'invalid-refresh-token', message: 'Invalid' }, 401),
    );

    await handleNhostRequest(withSession(storedSession(-60), { url: linkUrl }));

    expect(sessionCookie()).toMatchObject({
      refreshToken: 'new-refresh-token',
    });
  });

  it('keeps a live session and revokes the link instead', async () => {
    fetchMock.mockResolvedValue(json('OK', 200));

    await handleNhostRequest(withSession(storedSession(900), { url: linkUrl }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/signout$/);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      refreshToken: 'link-token',
    });
    expect([...written.keys()]).toEqual([]);
  });

  it('marks a reset link with the page it landed on', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    const result = await handleNhostRequest(
      inRequest({
        url: `http://localhost:3000/auth/password/reset?${LINK_TOKEN_PARAM}=link-token&type=passwordReset`,
      }),
    );

    expect(result.pendingReset).toBe('/auth/password/reset');
    expect(written.get(PASSWORD_RESET_KEY)?.options).toMatchObject({
      httpOnly: true,
    });
  });

  // Its URL is the page that made the call, whose own request dealt with the
  // token already.
  it('leaves a remote call alone', async () => {
    await handleNhostRequest(
      inRequest({ url: linkUrl, method: 'POST', isRemoteRequest: true }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// An access token stays valid for its whole life after the session is
// revoked, so the hook asks whether the refresh token's row is still there.
describe('revoked sessions', () => {
  // Far enough from expiry that nothing refreshes, so every call is GraphQL.
  const live = JSON.stringify({
    ...JSON.parse(storedSession(900)),
    refreshTokenId: 'refresh-token-id',
  });

  const sessionRow = (row: unknown): Response =>
    json({ data: { authRefreshToken: row } }, 200);

  const graphqlBody = (call: number): { query: string; variables: object } =>
    JSON.parse(String(fetchMock.mock.calls[call][1]?.body));

  it('signs out a session whose refresh token is gone', async () => {
    fetchMock.mockResolvedValueOnce(sessionRow(null));

    const result = await handleNhostRequest(withSession(live));

    expect(result.session).toBeNull();
    expect(graphqlBody(0).variables).toEqual({ id: 'refresh-token-id' });
    expect(isDeleted(written.get(DEFAULT_SESSION_KEY))).toBe(true);
  });

  it('keeps the session when GraphQL cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    expect(
      (await handleNhostRequest(withSession(live))).session,
    ).not.toBeNull();
  });
});

// Auth rate-limits by address, so it has to see the visitor's rather than the
// server's, and nothing else needs it.
describe('visitor address', () => {
  it('goes to auth and not to GraphQL', async () => {
    withSession(storedSession(900), { clientAddress: '203.0.113.7' });
    fetchMock.mockImplementation(async () => json({ data: {} }, 200));

    const nhost = createNhostClient();
    await nhost.auth.sendVerificationEmail({ email: 'user@example.com' });
    await nhost.graphql.request({ query: '{ __typename }' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('.auth.');
    expect(sentHeader(0, 'X-Forwarded-For')).toBe('203.0.113.7');
    expect(String(fetchMock.mock.calls[1][0])).toContain('.graphql.');
    expect(sentHeader(1, 'X-Forwarded-For')).toBeNull();
  });

  it('goes to auth when the hook refreshes', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    await handleNhostRequest(
      withSession(storedSession(30), { clientAddress: '203.0.113.7' }),
    );

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/token$/);
    expect(sentHeader(0, 'X-Forwarded-For')).toBe('203.0.113.7');
  });
});

// The account actions patch the cookie's user after a profile write, so the nav
// shows the change on the refresh that follows rather than after the next token
// refresh.
describe('updateSessionUser', () => {
  it('rewrites the user without rotating the tokens', async () => {
    const accessToken = jwt(900);
    withSession(
      JSON.stringify({
        ...JSON.parse(storedSession(900)),
        accessToken,
        user: { id: 'user-id', displayName: 'Ada', avatarUrl: 'old' },
      }),
    );

    updateSessionUser(createNhostClient(), { avatarUrl: 'new' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionCookie()).toMatchObject({
      accessToken,
      refreshToken: 'old-refresh-token',
      user: { id: 'user-id', displayName: 'Ada', avatarUrl: 'new' },
    });
    expect(written.get(DEFAULT_SESSION_KEY)?.options).toMatchObject({
      httpOnly: true,
    });
  });
});
