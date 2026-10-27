import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut } from '@/lib/nhost/actions';
import {
  createNhostClient,
  getVerifiedUser,
  handleNhostProxy,
  LINK_TOKEN_PARAM,
  PASSWORD_RESET_KEY,
  updateSessionUser,
} from '@/lib/nhost/server';
import { SIGNED_IN_KEY } from '@/lib/nhost/signed-in';

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));

// Writes land on a real response's cookie jar, which is what `cookies()` hands
// a server action, so they can be read back as Set-Cookie lines.
const written = vi.hoisted(() => ({
  response: undefined as NextResponse | undefined,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === DEFAULT_SESSION_KEY && cookie.value
        ? { value: cookie.value }
        : undefined,
    set: (...args: Parameters<NextResponse['cookies']['set']>) =>
      written.response?.cookies.set(...args),
    delete: (name: string) => written.response?.cookies.delete(name),
  }),
}));

const fetchMock = vi.fn<typeof fetch>();

// A cookie the visitor wrote themselves: an expiry an hour out, so nothing
// tries to refresh it, and somebody else's user.
const forgedSession = JSON.stringify({
  accessToken: 'not-a-jwt',
  refreshToken: '00000000-0000-0000-0000-000000000000',
  decodedToken: { exp: Date.now() + 60 * 60 * 1000 },
  user: { id: 'victim-id', email: 'admin@example.com' },
});

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sentAuthorization = (): string | null =>
  new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization');

describe('getVerifiedUser', () => {
  beforeEach(() => {
    cookie.value = undefined;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a session cookie with a forged expiry', async () => {
    cookie.value = forgedSession;
    fetchMock.mockResolvedValue(
      json({ error: 'invalid-token', message: 'Invalid token' }, 401),
    );

    expect(await getVerifiedUser()).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/user$/);
    expect(sentAuthorization()).toBe('Bearer not-a-jwt');
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

const proxyRequest = (
  session: string,
  url = 'http://localhost:3000/',
  headers: Record<string, string> = {},
): NextRequest =>
  new NextRequest(url, {
    headers: {
      ...headers,
      cookie: `${DEFAULT_SESSION_KEY}=${encodeURIComponent(session)}`,
    },
  });

// Runs the proxy for a visitor holding `session` and returns what it sends
// back, so the cookies are checked as the browser would receive them.
const proxyResponse = async (
  session: string,
  url = 'http://localhost:3000/',
): Promise<NextResponse> => {
  const { applySessionCookies } = await handleNhostProxy(
    proxyRequest(session, url),
  );

  return applySessionCookies(NextResponse.next());
};

const setCookie = (response: NextResponse, name: string): string =>
  response.headers.getSetCookie().find((line) => line.startsWith(`${name}=`)) ??
  '';

const maxAge = (line: string): number =>
  Number(/Max-Age=(\d+)/i.exec(line)?.[1]);

describe('session cookies', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Inside the proxy's refresh margin, so every case below rotates it.
  const expiring = storedSession(30);

  it('keeps the refresh token in an httpOnly cookie', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    const line = setCookie(await proxyResponse(expiring), DEFAULT_SESSION_KEY);

    expect(decodeURIComponent(line)).toContain('new-refresh-token');
    expect(line).toMatch(/; HttpOnly/i);
    expect(maxAge(line)).toBe(60 * 60 * 24 * 30);
  });

  it('gives the browser a signed-in flag and nothing else', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    const line = setCookie(await proxyResponse(expiring), SIGNED_IN_KEY);

    expect(line).toMatch(new RegExp(`^${SIGNED_IN_KEY}=1;`));
    expect(line).not.toMatch(/HttpOnly/i);
    expect(line).not.toContain('token');
  });

  it('deletes the session cookies when the session is rejected', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async () =>
      json({ error: 'invalid-refresh-token', message: 'Invalid' }, 401),
    );

    const response = await proxyResponse(storedSession(-60));

    for (const name of [
      DEFAULT_SESSION_KEY,
      SIGNED_IN_KEY,
      PASSWORD_RESET_KEY,
    ]) {
      expect(setCookie(response, name)).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });
});

describe('link redemption', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const linkUrl = `http://localhost:3000/?${LINK_TOKEN_PARAM}=link-token`;

  it('redeems the link over a session the auth service rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (_, init) =>
      String(init?.body).includes('link-token')
        ? refreshed(jwt(900))
        : json({ error: 'invalid-refresh-token', message: 'Invalid' }, 401),
    );

    const response = await proxyResponse(storedSession(-60), linkUrl);

    expect(
      decodeURIComponent(setCookie(response, DEFAULT_SESSION_KEY)),
    ).toContain('new-refresh-token');
  });

  it('keeps a live session instead of redeeming the link', async () => {
    const response = await proxyResponse(storedSession(900), linkUrl);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

// An access token stays valid for its whole life after the session is
// revoked, so the proxy asks whether the refresh token's row is still there.
describe('revoked sessions', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Far enough from expiry that nothing refreshes, so every call is GraphQL.
  const live = JSON.stringify({
    ...JSON.parse(storedSession(900)),
    refreshTokenId: 'refresh-token-id',
  });

  const sessionRow = (row: unknown): Response =>
    json({ data: { authRefreshToken: row } }, 200);

  const graphqlBody = (call: number): { query: string; variables: object } =>
    JSON.parse(String(fetchMock.mock.calls[call][1]?.body));

  const visit = (headers: Record<string, string> = {}) =>
    handleNhostProxy(proxyRequest(live, undefined, headers));

  it('signs out a session whose refresh token is gone', async () => {
    fetchMock.mockResolvedValueOnce(sessionRow(null));

    const result = await visit();
    const response = result.applySessionCookies(NextResponse.next());

    expect(result.session).toBeNull();
    expect(graphqlBody(0).variables).toEqual({ id: 'refresh-token-id' });
    for (const name of [DEFAULT_SESSION_KEY, SIGNED_IN_KEY]) {
      expect(setCookie(response, name)).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });

  it('keeps the session when GraphQL cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    expect((await visit()).session).not.toBeNull();
  });
});

// Server actions write through `createNhostClient` rather than the proxy, so
// the same properties are checked again on that path.
describe('session cookies from server actions', () => {
  beforeEach(() => {
    cookie.value = undefined;
    written.response = NextResponse.next();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    written.response = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const _signIn = async (accessToken: string): Promise<NextResponse> => {
    fetchMock.mockImplementation(async () =>
      json({ session: await refreshed(accessToken).json() }, 200),
    );

    const nhost = await createNhostClient();
    await nhost.auth.signInEmailPassword({
      email: 'user@example.com',
      password: 'password',
    });

    return written.response as NextResponse;
  };

  it('deletes both cookies on sign-out', async () => {
    cookie.value = storedSession(900);
    fetchMock.mockImplementation(async () => json('OK', 200));

    expect(await signOut()).toEqual({});

    for (const name of [DEFAULT_SESSION_KEY, SIGNED_IN_KEY]) {
      expect(setCookie(written.response as NextResponse, name)).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    }
  });
});

// The account actions patch the cookie's user after a profile write, so the nav
// shows the change on the refresh that follows rather than after the next token
// refresh.
describe('updateSessionUser', () => {
  beforeEach(() => {
    cookie.value = undefined;
    written.response = NextResponse.next();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    written.response = undefined;
    vi.unstubAllGlobals();
  });

  const sessionCookie = (): Record<string, unknown> =>
    JSON.parse(
      decodeURIComponent(
        setCookie(written.response as NextResponse, DEFAULT_SESSION_KEY)
          .split(';')[0]
          .slice(`${DEFAULT_SESSION_KEY}=`.length),
      ),
    );

  it('rewrites the user in both cookies without rotating the tokens', async () => {
    const accessToken = jwt(900);
    cookie.value = JSON.stringify({
      ...JSON.parse(storedSession(900)),
      accessToken,
      user: { id: 'user-id', displayName: 'Ada', avatarUrl: 'old' },
    });

    updateSessionUser(await createNhostClient(), { avatarUrl: 'new' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionCookie()).toMatchObject({
      accessToken,
      refreshToken: 'old-refresh-token',
      user: { id: 'user-id', displayName: 'Ada', avatarUrl: 'new' },
    });
    expect(
      setCookie(written.response as NextResponse, DEFAULT_SESSION_KEY),
    ).toMatch(/; HttpOnly/i);

    expect(setCookie(written.response as NextResponse, SIGNED_IN_KEY)).toMatch(
      new RegExp(`^${SIGNED_IN_KEY}=1;`),
    );
  });
});
