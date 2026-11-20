import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inRequest } from '#lib/testing/appServer.ts';
import { changePassword } from './actions.remote.ts';

// The real server client, so the SDK's own handling of the session is in
// play: it deletes the cookie when the change succeeds, and the sign-in after
// it writes the new one.
vi.mock('$app/server', () => import('#lib/testing/appServer.ts'));

const fetchMock = vi.fn<typeof fetch>();

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const jwt = (): string =>
  [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: 'user-id', exp: Math.floor(Date.now() / 1000) + 900 }),
    'signature',
  ].join('.');

const session = (refreshToken: string) => ({
  accessToken: jwt(),
  accessTokenExpiresIn: 900,
  refreshToken,
  refreshTokenId: `${refreshToken}-id`,
  user: { id: 'user-id', email: 'user@example.com' },
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const path = (call: number): string =>
  new URL(String(fetchMock.mock.calls[call][0])).pathname;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('changePassword on the server client', () => {
  it('leaves this browser holding the session it signed back in with', async () => {
    const current = session('old-refresh');
    const { written } = inRequest({
      cookies: {
        [DEFAULT_SESSION_KEY]: JSON.stringify({
          ...current,
          decodedToken: { exp: Date.now() + 900_000 },
        }),
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/user/password')
        ? json('OK')
        : json({ session: session('new-refresh') }),
    );

    expect(await changePassword({ newPassword: 'correct horse' })).toEqual({
      success: true,
      signedIn: true,
    });

    expect([path(0), path(1)]).toEqual([
      '/v1/user/password',
      '/v1/signin/email-password',
    ]);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization'),
    ).toBe(`Bearer ${current.accessToken}`);
    expect(
      JSON.parse(written.get(DEFAULT_SESSION_KEY)?.value ?? 'null'),
    ).toMatchObject({ refreshToken: 'new-refresh' });
  });
});
