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

// Runs the proxy for a visitor holding `session` and returns what it sends
// back, so the cookies are checked as the browser would receive them.
const proxyResponse = async (
  session: string,
  url = 'http://localhost:3000/',
): Promise<NextResponse> => {
  const request = new NextRequest(url, {
    headers: {
      cookie: `${DEFAULT_SESSION_KEY}=${encodeURIComponent(session)}`,
    },
  });
  const { applySessionCookies } = await handleNhostProxy(request);

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

  it('deletes both cookies when the session is rejected', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async () =>
      json({ error: 'invalid-refresh-token', message: 'Invalid' }, 401),
    );

    const response = await proxyResponse(storedSession(-60));

    for (const name of [DEFAULT_SESSION_KEY, ACCESS_TOKEN_KEY]) {
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
});
