// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_KEY } from '@/lib/nhost/access-token';
import { nhost } from '@/lib/nhost/client';

// The SDK binds `fetch` when the client is built, which is when `client.ts`
// is imported, so the stub has to be in place before that.
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', mock);
  return mock;
});

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const jwt = (exp: number): string =>
  `${base64url({ alg: 'none' })}.${base64url({ exp })}.signature`;

// What the proxy writes: JSON, percent-encoded once on the wire.
function stubAccessTokenCookie(accessToken: string, expMs: number): void {
  const value = encodeURIComponent(
    JSON.stringify({ accessToken, decodedToken: { exp: expMs } }),
  );
  vi.spyOn(document, 'cookie', 'get').mockReturnValue(
    `${ACCESS_TOKEN_KEY}=${value}`,
  );
}

const requestedPaths = (): string[] =>
  fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);

const sentAuthorization = (): string | null =>
  new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization');

describe('browser nhost client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => json({ id: 'user-id' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sends the access token from the readable cookie', async () => {
    stubAccessTokenCookie('browser-token', Date.now() + 60 * 60 * 1000);

    await nhost.auth.getUser();

    expect(sentAuthorization()).toBe('Bearer browser-token');
  });

  it('sends no token when the cookie is gone', async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('');

    await nhost.auth.getUser();

    expect(sentAuthorization()).toBeNull();
    expect(requestedPaths()).toEqual(['/v1/user']);
  });

  // `createClient` would refresh this token before sending the request. This
  // client has no refresh token, and the proxy is the only rotator.
  it('never asks for a new token, even with an expired one', async () => {
    stubAccessTokenCookie('expired-token', Date.now() - 1000);

    await nhost.auth.getUser();

    expect(requestedPaths()).toEqual(['/v1/user']);
    expect(sentAuthorization()).toBe('Bearer expired-token');
  });

  it('keeps nothing from an auth response that carries a session', async () => {
    stubAccessTokenCookie('browser-token', Date.now() + 60 * 60 * 1000);
    const cookieWrites = vi.spyOn(document, 'cookie', 'set');
    const handedOver = vi.fn();
    const unsubscribe = nhost.sessionStorage.onChange(handedOver);
    fetchMock.mockResolvedValueOnce(
      json({
        session: {
          accessToken: jwt(Math.floor(Date.now() / 1000) + 900),
          accessTokenExpiresIn: 900,
          refreshToken: 'refresh-token',
          refreshTokenId: 'refresh-token-id',
          user: { id: 'user-id' },
        },
      }),
    );

    await nhost.auth.signInEmailPassword({
      email: 'ada@example.com',
      password: 'password',
    });
    unsubscribe();

    expect(handedOver).toHaveBeenCalledOnce();
    expect(cookieWrites).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(nhost.getUserSession()?.accessToken).toBe('browser-token');
  });
});
