import type { StoredSession } from '@nhost/nhost-js/session';
import { json, jwt, liveSession } from '@/test/session';

type Actions = typeof import('@/lib/nhost/actions');
type Client = typeof import('@/lib/nhost/client');

// The SDK reads `fetch` when the client is built, at import, so the modules
// load again after it is stubbed.
const mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
global.fetch = mockFetch as typeof fetch;

let signOut: Actions['signOut'];
let nhost: Client['nhost'];

// Inside the SDK's 60 second margin, so the next request refreshes first.
const expiring = (): StoredSession =>
  liveSession({
    accessToken: jwt(30),
    accessTokenExpiresIn: 30,
    refreshToken: 'old-refresh-token',
    decodedToken: { exp: Date.now() + 30 * 1000 },
  } as Partial<StoredSession>);

const requests = (): { path: string; body: unknown }[] =>
  mockFetch.mock.calls.map(([url, init]) => ({
    path: String(url).replace(/^https?:\/\/[^/]+/, ''),
    body: JSON.parse(String(init?.body)),
  }));

beforeEach(() => {
  mockFetch.mockReset();
  jest.isolateModules(() => {
    ({ signOut } = require('@/lib/nhost/actions'));
    ({ nhost } = require('@/lib/nhost/client'));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('signOut', () => {
  it('revokes the refresh token the SDK rotated before signing out', async () => {
    nhost.sessionStorage.set(expiring());
    mockFetch.mockImplementation(async (url) =>
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

  // Nothing reached auth, so the session is still live there and here.
  it('keeps the session when the request never reaches the server', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    nhost.sessionStorage.set(liveSession());
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    expect(await signOut()).toEqual({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });
    expect(nhost.getUserSession()).not.toBeNull();
  });

  it('is signed out here when auth answers with an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    nhost.sessionStorage.set(liveSession());
    mockFetch.mockResolvedValue(json({ error: 'internal' }, 500));

    expect(await signOut()).toEqual({
      error:
        'You are signed out on this device, but the sign-out request failed.',
    });
    expect(nhost.getUserSession()).toBeNull();
  });
});
