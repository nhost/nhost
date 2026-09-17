import { CookieStorage, type StoredSession } from '@nhost/nhost-js/session';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cookieOptions,
  createAnonymousClient,
  handleNhostProxy,
  parseSessionCookie,
  serializeSessionCookie,
} from '@/lib/nhost/server';

const session: StoredSession = {
  accessToken: 'header.payload.signature',
  accessTokenExpiresIn: 900,
  refreshTokenId: 'refresh-token-id',
  refreshToken: 'refresh token;/☃',
  decodedToken: {
    sub: 'user-id',
    'https://hasura.io/jwt/claims': {
      'x-hasura-user-id': 'user-id',
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// Both halves of the app read the same cookie, so what matters is the value on
// the wire, not what either side passes to its own API. Next percent-encodes on
// write and decodes on read; the SDK's CookieStorage does its own single round
// of encoding against document.cookie. These tests drive the real objects on
// both ends so an extra layer of encoding on either side fails here rather than
// in a browser, where CookieStorage deletes a cookie it cannot parse.
const wireValue = (setCookie: string): string =>
  setCookie.split(';', 1)[0]?.slice('nhostSession='.length) ?? '';

describe('Nhost session cookie serialization', () => {
  it('writes a cookie the browser SDK can read', () => {
    const response = NextResponse.next();
    response.cookies.set({
      name: 'nhostSession',
      value: serializeSessionCookie(session),
      ...cookieOptions,
    });

    const documentStub = {
      cookie: `nhostSession=${wireValue(response.headers.getSetCookie()[0] ?? '')}`,
    };
    vi.stubGlobal('document', documentStub);

    expect(new CookieStorage({ secure: false }).get()).toEqual(session);
  });

  it('reads a cookie the browser SDK wrote', () => {
    const documentStub = { cookie: '' };
    vi.stubGlobal('document', documentStub);

    new CookieStorage({ secure: false }).set(session);

    const request = new NextRequest('http://localhost:3000/protected', {
      headers: { cookie: documentStub.cookie.split(';', 1)[0] ?? '' },
    });

    expect(
      parseSessionCookie(request.cookies.get('nhostSession')?.value ?? null),
    ).toEqual(session);
  });

  it('returns null for malformed cookies', () => {
    expect(parseSessionCookie(null)).toBeNull();
    expect(parseSessionCookie('not-json')).toBeNull();
  });
});

const loadCookieOptions = async (
  nodeEnv: string,
): Promise<typeof cookieOptions> => {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();

  return (await import('@/lib/nhost/server')).cookieOptions;
};

describe('session cookie options', () => {
  // httpOnly is deliberately false so the browser SDK can read the session;
  // the rest of the contract is what keeps that tradeoff bounded.
  it('keeps the documented browser-readable contract', async () => {
    expect(await loadCookieOptions('development')).toEqual({
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  it('marks the cookie secure in production', async () => {
    expect((await loadCookieOptions('production')).secure).toBe(true);
  });
});

const proxyRequest = (cookie?: string): NextRequest =>
  new NextRequest(
    'http://localhost:3000/protected',
    cookie ? { headers: { cookie } } : undefined,
  );

const stubRefreshToken = (
  status: number,
  body: unknown,
): ReturnType<typeof vi.fn> => {
  const fetchStub = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchStub);

  return fetchStub;
};

// The SDK decodes the access token of every session it stores, so a refresh
// response has to carry a structurally valid JWT.
const accessToken = (sub: string): string => {
  const claims = Buffer.from(
    JSON.stringify({
      sub,
      exp: Math.floor(Date.now() / 1000) + 900,
      'https://hasura.io/jwt/claims': { 'x-hasura-user-id': sub },
    }),
  ).toString('base64url');

  return `header.${claims}.signature`;
};

const cookieSession = (
  cookies: { get: (name: string) => { value: string } | undefined } | undefined,
): StoredSession | null =>
  parseSessionCookie(cookies?.get('nhostSession')?.value ?? null);

// The cookie a signed-in browser sends, produced by the SDK rather than
// hand-encoded, so the proxy is exercised against the real wire format. Built
// once at import time because it stubs `document`, which the tests below also
// do for their own purposes.
const signedInCookie = ((): string => {
  const documentStub = { cookie: '' };
  vi.stubGlobal('document', documentStub);
  new CookieStorage({ secure: false }).set(session);
  vi.unstubAllGlobals();

  return documentStub.cookie.split(';', 1)[0] ?? '';
})();

describe('proxy session refresh', () => {
  it('applies a refreshed session to the request and the response', async () => {
    const refreshed = {
      accessToken: accessToken('user-id'),
      accessTokenExpiresIn: 900,
      refreshTokenId: 'refreshed-refresh-token-id',
      refreshToken: 'refreshed-refresh-token',
    };
    stubRefreshToken(200, refreshed);

    const request = proxyRequest(signedInCookie);

    const { session: result, applySessionCookies } =
      await handleNhostProxy(request);

    expect(result?.accessToken).toBe(refreshed.accessToken);
    expect(cookieSession(request.cookies)).toMatchObject({
      accessToken: refreshed.accessToken,
      refreshToken: 'refreshed-refresh-token',
    });

    const response = applySessionCookies(NextResponse.next());

    expect(cookieSession(response.cookies)).toMatchObject({
      accessToken: refreshed.accessToken,
      refreshToken: 'refreshed-refresh-token',
    });

    const setCookie = response.headers.getSetCookie().join('\n');

    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('SameSite=lax');
  });

  it('clears the session everywhere when the refresh token is rejected', async () => {
    vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() });
    stubRefreshToken(401, { error: 'invalid-refresh-token' });

    const request = proxyRequest(signedInCookie);

    const { session: result, applySessionCookies } =
      await handleNhostProxy(request);

    expect(result).toBeNull();
    expect(request.cookies.get('nhostSession')).toBeUndefined();

    const redirect = applySessionCookies(
      NextResponse.redirect(new URL('/signin', request.url)),
    );

    expect(redirect.headers.getSetCookie()).toContainEqual(
      expect.stringContaining('nhostSession=;'),
    );
  });

  it('records no cookie mutations when there is no session', async () => {
    const fetchStub = stubRefreshToken(200, session);

    const { session: result, applySessionCookies } = await handleNhostProxy(
      proxyRequest(),
    );

    expect(result).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
    expect(
      applySessionCookies(NextResponse.next()).headers.getSetCookie(),
    ).toEqual([]);
  });
});

// Public pages query through this client so Hasura answers them as `public`.
// If it ever picked a session up, a signed-in visitor would be answered as
// `user` instead, and that role's row-level filter would hide every row
// belonging to anybody else: the shared list would render empty for exactly
// the people most likely to open it, and only for them.
describe('anonymous client', () => {
  it('has no session', () => {
    expect(createAnonymousClient().getUserSession()).toBeNull();
  });

  it('stays anonymous even when a session is written into it', () => {
    const client = createAnonymousClient();

    client.sessionStorage.set({
      accessToken: accessToken('user-id'),
      accessTokenExpiresIn: 900,
      refreshTokenId: 'refresh-token-id',
      refreshToken: 'refresh-token',
    });

    expect(client.sessionStorage.get()).toBeNull();
    expect(client.getUserSession()).toBeNull();
  });
});
