import { CookieStorage, type StoredSession } from '@nhost/nhost-js/session';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cookieOptions,
  createAnonymousClient,
  handleNhostProxy,
  PASSWORD_RESET_GRANT_COOKIE,
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

const loadGrant = async (
  nodeEnv: string,
): Promise<{ name: string; options: { secure: boolean; maxAge: number } }> => {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();

  const mod = await import('@/lib/nhost/server');

  return {
    name: mod.PASSWORD_RESET_GRANT_COOKIE,
    options: mod.passwordResetGrantOptions,
  };
};

// The grant is an exemption from re-authentication, so what bounds it is the
// cookie's own contract rather than anything in the flow that reads it.
describe('password reset grant cookie options', () => {
  it('is httpOnly, scoped to the site, and short-lived', async () => {
    const { options } = await loadGrant('development');

    expect(options).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
      maxAge: 15 * 60,
    });
  });

  // `__Host-` pins the cookie to this exact host, so a sibling subdomain
  // cannot plant one. The prefix requires Secure, which is why it is only
  // taken in production - development serves plain http on localhost.
  it('takes the __Host- prefix once it can be secure', async () => {
    const production = await loadGrant('production');

    expect(production.name).toBe('__Host-nhostPasswordResetGrant');
    expect(production.options.secure).toBe(true);

    const development = await loadGrant('development');

    expect(development.name).toBe('nhostPasswordResetGrant');
    expect(development.options.secure).toBe(false);
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

// A refresh token on the query string signs whoever opens the link in. Auth
// only ever puts one there on the redirect from its own verify endpoint, and
// always alongside a `type`, so a redemption outside those conditions can only
// be someone else's token: a link to any page carrying the attacker's token
// would swap the visitor's session for theirs, and everything typed next would
// be written into the attacker's account.
describe('proxy auth link redemption', () => {
  const linkRequest = (path: string, query: string): NextRequest =>
    new NextRequest(`http://localhost:3000${path}${query}`);

  const refreshed = (userId = 'link-user-id'): Record<string, unknown> => ({
    accessToken: accessToken(userId),
    accessTokenExpiresIn: 900,
    refreshTokenId: 'link-refresh-token-id',
    refreshToken: 'link-refresh-token',
    user: { id: userId },
  });

  it('redeems a token an auth email could have produced', async () => {
    const fetchStub = stubRefreshToken(200, refreshed());

    const { session: result, consumedLinkToken } = await handleNhostProxy(
      linkRequest('/reset-password', '?refreshToken=abc&type=passwordReset'),
    );

    expect(consumedLinkToken).toBe(true);
    expect(fetchStub).toHaveBeenCalledOnce();
    expect(result?.refreshToken).toBe('link-refresh-token');
  });

  it('ignores a token on a path no auth email points at', async () => {
    const fetchStub = stubRefreshToken(200, refreshed());

    const { session: result, consumedLinkToken } = await handleNhostProxy(
      linkRequest('/protected', '?refreshToken=abc&type=passwordReset'),
    );

    expect(consumedLinkToken).toBe(false);
    expect(result).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('ignores a token with no type, or a type auth never emits', async () => {
    for (const query of [
      '?refreshToken=abc',
      '?refreshToken=abc&type=',
      '?refreshToken=abc&type=somethingElse',
      // The `LinkType` spellings, which name the same things but are not what
      // the verify redirect carries. Accepting these instead of the real ones
      // is the mistake this pins down.
      '?refreshToken=abc&type=emailVerify',
      '?refreshToken=abc&type=signinPasswordless',
    ]) {
      const fetchStub = stubRefreshToken(200, refreshed());

      const { consumedLinkToken } = await handleNhostProxy(
        linkRequest('/reset-password', query),
      );

      expect(consumedLinkToken).toBe(false);
      expect(fetchStub).not.toHaveBeenCalled();
    }
  });

  // Every ticket type `getTicketType` can put on the redirect, so a template
  // that grows a magic-link or verification flow redeems the link rather than
  // dropping the visitor on an anonymous page.
  it('redeems every type the auth service actually emits', async () => {
    for (const type of [
      'emailConfirmChange',
      'passwordlessEmail',
      'passwordReset',
      'verifyEmail',
    ]) {
      const fetchStub = stubRefreshToken(200, refreshed());

      const { consumedLinkToken } = await handleNhostProxy(
        linkRequest('/profile', `?refreshToken=abc&type=${type}`),
      );

      expect(consumedLinkToken, type).toBe(true);
      expect(fetchStub).toHaveBeenCalledOnce();
    }
  });

  // Narrowing redemption to the paths auth emails land on reduced login CSRF
  // but did not end it: a crafted link on one of those paths would still swap
  // a signed-in visitor's session for the attacker's, and the proxy would then
  // strip the parameters so nothing was left to notice.
  it('refuses a token for an account other than the one signed in', async () => {
    vi.stubGlobal('console', { ...console, error: vi.fn() });

    // Answers by which token was sent, because two different exchanges happen
    // on this one request: the link's token, which must be refused, and then
    // the visitor's own, which must still go through as it always does.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: { body?: string }) => {
        const sentLinkToken = String(init?.body ?? '').includes('"abc"');

        return new Response(
          JSON.stringify(
            sentLinkToken
              ? refreshed('somebody-else')
              : {
                  accessToken: accessToken('user-id'),
                  accessTokenExpiresIn: 900,
                  refreshTokenId: 'own-refresh-token-id',
                  refreshToken: 'own-refresh-token',
                  user: { id: 'user-id' },
                },
          ),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const request = new NextRequest(
      'http://localhost:3000/profile?refreshToken=abc&type=emailConfirmChange',
      { headers: { cookie: signedInCookie } },
    );

    const { session: result, applySessionCookies } =
      await handleNhostProxy(request);

    // The visitor is still themselves, on this request and on the response the
    // browser will keep.
    expect(result?.refreshToken).toBe('own-refresh-token');
    expect(cookieSession(request.cookies)?.user?.id).toBe('user-id');
    expect(
      cookieSession(applySessionCookies(NextResponse.next()).cookies)?.user?.id,
    ).toBe('user-id');
  });

  // The same link is how a signed-out visitor gets in, and how a signed-in one
  // confirms their own email change, so neither may be refused.
  it('redeems a token for the account already signed in', async () => {
    stubRefreshToken(200, refreshed('user-id'));

    const { consumedLinkToken } = await handleNhostProxy(
      new NextRequest(
        'http://localhost:3000/profile?refreshToken=abc&type=emailConfirmChange',
        { headers: { cookie: signedInCookie } },
      ),
    );

    expect(consumedLinkToken).toBe(true);
  });

  // The grant is the server's own record that this browser followed a reset
  // link, and it is what `changePassword` accepts in place of the current
  // password. It names the account it was issued for, so it cannot be carried
  // to a different one.
  it('grants a password reset only for a passwordReset link', async () => {
    stubRefreshToken(200, refreshed());

    const { applySessionCookies } = await handleNhostProxy(
      linkRequest('/reset-password', '?refreshToken=abc&type=passwordReset'),
    );
    const granted = applySessionCookies(NextResponse.next());

    expect(granted.cookies.get(PASSWORD_RESET_GRANT_COOKIE)?.value).toBe(
      'link-user-id',
    );
  });

  // Asserted against the grant's own Set-Cookie line rather than against the
  // whole list: the session cookie is deliberately not httpOnly, so "some
  // cookie on this response is HttpOnly" would pass while saying nothing about
  // this one.
  it('sets the grant with the flags that bound it', async () => {
    stubRefreshToken(200, refreshed());

    const { applySessionCookies } = await handleNhostProxy(
      linkRequest('/reset-password', '?refreshToken=abc&type=passwordReset'),
    );

    const grant = applySessionCookies(NextResponse.next())
      .headers.getSetCookie()
      .find((line) => line.startsWith(`${PASSWORD_RESET_GRANT_COOKIE}=`));

    expect(grant).toBeDefined();
    expect(grant).toContain('HttpOnly');
    expect(grant).toContain('Path=/');
    expect(grant).toContain('SameSite=lax');
    expect(grant).toContain('Max-Age=900');
  });

  it('grants nothing for an email-change link', async () => {
    stubRefreshToken(200, refreshed());

    const { applySessionCookies } = await handleNhostProxy(
      linkRequest('/profile', '?refreshToken=abc&type=emailConfirmChange'),
    );

    expect(
      applySessionCookies(NextResponse.next()).cookies.get(
        PASSWORD_RESET_GRANT_COOKIE,
      ),
    ).toBeUndefined();
  });
});

// Next prefetches every <Link> in view through this same proxy, concurrently
// with the real request. Refresh tokens rotate, so only one caller can win;
// letting a prefetch race the document request is what turns an idle tab into
// a spurious sign-out.
describe('proxy session refresh on prefetch', () => {
  const rotated = (): Record<string, unknown> => ({
    accessToken: accessToken('user-id'),
    accessTokenExpiresIn: 900,
    refreshTokenId: 'rotated',
    refreshToken: 'rotated-refresh-token',
  });

  it('does not rotate the refresh token for a prefetch', async () => {
    const fetchStub = stubRefreshToken(200, rotated());

    const { session: result, applySessionCookies } = await handleNhostProxy(
      new NextRequest('http://localhost:3000/protected', {
        headers: { cookie: signedInCookie, 'next-router-prefetch': '1' },
      }),
    );

    expect(fetchStub).not.toHaveBeenCalled();
    // Still the stored session, so access control decides the same way.
    expect(result?.refreshToken).toBe(session.refreshToken);
    expect(
      applySessionCookies(NextResponse.next()).headers.getSetCookie(),
    ).toEqual([]);
  });

  it('still refreshes a real navigation', async () => {
    const fetchStub = stubRefreshToken(200, rotated());

    const { session: result } = await handleNhostProxy(
      proxyRequest(signedInCookie),
    );

    expect(fetchStub).toHaveBeenCalledOnce();
    expect(result?.refreshToken).toBe('rotated-refresh-token');
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
