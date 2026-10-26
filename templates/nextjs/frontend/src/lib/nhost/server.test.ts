import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_KEY,
  readAccessTokenCookie,
} from '@/lib/nhost/access-token';
import { signOut } from '@/lib/nhost/actions';
import {
  createNhostClient,
  getVerifiedUser,
  handleNhostProxy,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
  PASSWORD_RESET_KEY,
  updateSessionUser,
} from '@/lib/nhost/server';

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

  it('returns the user the auth service vouches for, not the cookie', async () => {
    cookie.value = forgedSession;
    fetchMock.mockResolvedValue(
      json({ id: 'real-id', email: 'user@example.com' }, 200),
    );

    expect(await getVerifiedUser()).toMatchObject({
      id: 'real-id',
      email: 'user@example.com',
    });
  });

  it.each([
    ['an empty 200', () => new Response('', { status: 200 })],
    ['a 204', () => new Response(null, { status: 204 })],
    ['an empty object', () => json({}, 200)],
  ])('rejects %s, which carries no user', async (_, response) => {
    cookie.value = forgedSession;
    fetchMock.mockResolvedValue(response());

    expect(await getVerifiedUser()).toBeNull();
  });

  it('does not call the auth service without a session cookie', async () => {
    expect(await getVerifiedUser()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('gives the browser the access token and nothing else', async () => {
    const accessToken = jwt(900);
    fetchMock.mockImplementation(async () => refreshed(accessToken));

    const line = setCookie(await proxyResponse(expiring), ACCESS_TOKEN_KEY);

    expect(line).not.toMatch(/HttpOnly/i);
    expect(decodeURIComponent(line)).not.toContain('refresh-token');

    // What the browser client's storage makes of it, read back the way
    // `document.cookie` presents it.
    const session = readAccessTokenCookie(`other=1; ${line.split(';')[0]}`);
    expect(session?.accessToken).toBe(accessToken);
    expect(session?.refreshToken).toBe('');
  });

  it.each([900, 300])(
    'expires the access-token cookie with a %is token',
    async (lifetime) => {
      fetchMock.mockImplementation(async () => refreshed(jwt(lifetime)));

      const line = setCookie(await proxyResponse(expiring), ACCESS_TOKEN_KEY);

      expect(maxAge(line)).toBeGreaterThan(lifetime - 5);
      expect(maxAge(line)).toBeLessThanOrEqual(lifetime);
    },
  );

  it('deletes the session cookies when the session is rejected', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async () =>
      json({ error: 'invalid-refresh-token', message: 'Invalid' }, 401),
    );

    const response = await proxyResponse(storedSession(-60));

    for (const name of [
      DEFAULT_SESSION_KEY,
      ACCESS_TOKEN_KEY,
      PASSWORD_RESET_KEY,
    ]) {
      expect(setCookie(response, name)).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });
});

// Refresh tokens are single-use, so a prefetch that rotated alongside the real
// navigation could get the session cleared. Prefetches read it instead.
describe('prefetches', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const expiring = storedSession(30);

  it.each<Record<string, string>>([
    { 'next-router-prefetch': '1' },
    { 'next-router-prefetch': '2' },
    { 'next-router-prefetch': '3' },
    { 'next-router-segment-prefetch': '/_tree' },
    { purpose: 'prefetch' },
  ])('reads the stored session for %o', async (headers) => {
    const { session } = await handleNhostProxy(
      proxyRequest(expiring, undefined, headers),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(session).toEqual(JSON.parse(expiring));
  });

  it('refreshes an RSC request that is not a prefetch', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    await handleNhostProxy(proxyRequest(expiring, undefined, { rsc: '1' }));

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/token$/);
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

  // The proxy holds the visitor on this page until the password is saved.
  it('marks the page a reset link signed the visitor in on', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    const result = await handleNhostProxy(
      new NextRequest(
        `http://localhost:3000/reset?${LINK_TOKEN_PARAM}=link-token&${LINK_TYPE_PARAM}=passwordReset`,
      ),
    );
    const response = result.applySessionCookies(NextResponse.next());

    expect(result.pendingReset).toBe('/reset');
    const line = setCookie(response, PASSWORD_RESET_KEY);
    expect(line).toContain(`${PASSWORD_RESET_KEY}=%2Freset`);
    expect(line).toMatch(/; HttpOnly/i);
  });

  it('marks no reset for any other link', async () => {
    fetchMock.mockImplementation(async () => refreshed(jwt(900)));

    const result = await handleNhostProxy(
      new NextRequest(
        `http://localhost:3000/?${LINK_TOKEN_PARAM}=link-token&${LINK_TYPE_PARAM}=emailVerify`,
      ),
    );

    expect(result.pendingReset).toBeNull();
    expect(
      setCookie(
        result.applySessionCookies(NextResponse.next()),
        PASSWORD_RESET_KEY,
      ),
    ).toBe('');
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
    for (const name of [DEFAULT_SESSION_KEY, ACCESS_TOKEN_KEY]) {
      expect(setCookie(response, name)).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });

  it('records where a session is used from the first time it is seen', async () => {
    fetchMock
      .mockResolvedValueOnce(
        sessionRow({ id: 'refresh-token-id', metadata: null }),
      )
      .mockResolvedValueOnce(json({ data: {} }, 200));

    const result = await visit({
      'user-agent': 'Mozilla/5.0',
      'x-forwarded-for': '203.0.113.4, 10.0.0.1',
      'x-vercel-ip-country': 'de',
      'x-vercel-ip-city': 'M%C3%BCnchen',
    });

    expect(result.session).not.toBeNull();
    expect(graphqlBody(1).query).toContain('updateAuthRefreshToken');
    expect(graphqlBody(1).variables).toMatchObject({
      id: 'refresh-token-id',
      metadata: {
        ip: '203.0.113.4',
        userAgent: 'Mozilla/5.0',
        country: 'DE',
        city: 'München',
      },
    });
  });

  it('writes nothing while the stored details are current', async () => {
    fetchMock.mockResolvedValueOnce(
      sessionRow({
        id: 'refresh-token-id',
        metadata: {
          userAgent: 'Mozilla/5.0',
          seenAt: new Date().toISOString(),
        },
      }),
    );

    const result = await visit({ 'user-agent': 'Mozilla/5.0' });

    expect(result.session).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not look on a prefetch', async () => {
    const result = await visit({ 'next-router-prefetch': '1' });

    expect(result.session).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a GraphQL error',
      () => json({ errors: [{ message: 'field not found in type' }] }, 200),
    ],
    ['a server error', () => json({ error: 'internal' }, 500)],
  ])('keeps the session when the lookup returns %s', async (_, response) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(response());

    const result = await visit();

    expect(result.session).not.toBeNull();
    expect(
      result.applySessionCookies(NextResponse.next()).headers.getSetCookie(),
    ).toEqual([]);
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

  const signIn = async (accessToken: string): Promise<NextResponse> => {
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

  it('keeps the refresh token in an httpOnly cookie', async () => {
    const line = setCookie(await signIn(jwt(900)), DEFAULT_SESSION_KEY);

    expect(decodeURIComponent(line)).toContain('new-refresh-token');
    expect(line).toMatch(/; HttpOnly/i);
    expect(maxAge(line)).toBe(60 * 60 * 24 * 30);
  });

  it('gives the browser the access token and nothing else', async () => {
    const accessToken = jwt(900);
    const line = setCookie(await signIn(accessToken), ACCESS_TOKEN_KEY);

    expect(line).not.toMatch(/HttpOnly/i);
    expect(decodeURIComponent(line)).not.toContain('refresh-token');

    const session = readAccessTokenCookie(`other=1; ${line.split(';')[0]}`);
    expect(session?.accessToken).toBe(accessToken);
    expect(session?.refreshToken).toBe('');
  });

  it.each([900, 300])(
    'expires the access-token cookie with a %is token',
    async (lifetime) => {
      const line = setCookie(await signIn(jwt(lifetime)), ACCESS_TOKEN_KEY);

      expect(maxAge(line)).toBeGreaterThan(lifetime - 5);
      expect(maxAge(line)).toBeLessThanOrEqual(lifetime);
    },
  );

  it('deletes both cookies on sign-out', async () => {
    cookie.value = storedSession(900);
    fetchMock.mockImplementation(async () => json('OK', 200));

    expect(await signOut()).toEqual({});

    for (const name of [DEFAULT_SESSION_KEY, ACCESS_TOKEN_KEY]) {
      expect(setCookie(written.response as NextResponse, name)).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    }
  });

  // The flag is what the auth service acts on, so it has to reach the wire.
  it('asks the auth service to revoke every session when signing out everywhere', async () => {
    cookie.value = storedSession(900);
    fetchMock.mockImplementation(async () => json('OK', 200));

    await signOut({ all: true });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.all).toBe(true);
  });

  it.each([401, 500])(
    'reports this device as signed out when signing out everywhere gets a %i',
    async (status) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      cookie.value = storedSession(900);
      fetchMock.mockImplementation(async () =>
        json({ error: 'error', message: 'Failed' }, status),
      );

      expect(await signOut({ all: true })).toEqual({
        error:
          'You are signed out on this device, but your other sessions were not revoked. Sign in and try again.',
      });

      for (const name of [DEFAULT_SESSION_KEY, ACCESS_TOKEN_KEY]) {
        expect(setCookie(written.response as NextResponse, name)).toMatch(
          /Expires=Thu, 01 Jan 1970/,
        );
      }
    },
  );

  it('keeps the session when the auth service cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    cookie.value = storedSession(900);
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    expect(await signOut({ all: true })).toEqual({
      error: 'Could not reach the server. You are still signed in.',
    });
    expect(written.response?.headers.getSetCookie()).toEqual([]);
  });

  // A retry after a failed sign-out everywhere lands here, and reporting
  // success would leave the other sessions live.
  it('does not report success for signing out everywhere without a session', async () => {
    const result = await signOut({ all: true });

    expect(result.error).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// The account actions patch the cookie's user after a profile write, so the
// nav shows the change on the refresh that follows rather than after the
// next token refresh.
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

    const line = setCookie(written.response as NextResponse, ACCESS_TOKEN_KEY);
    expect(readAccessTokenCookie(line.split(';')[0])?.accessToken).toBe(
      accessToken,
    );
  });

  it('writes nothing without a session', async () => {
    updateSessionUser(await createNhostClient(), { avatarUrl: 'new' });

    expect(written.response?.headers.getSetCookie()).toEqual([]);
  });
});
