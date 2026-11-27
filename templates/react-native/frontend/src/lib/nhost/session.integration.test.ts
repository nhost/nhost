import * as SecureStore from 'expo-secure-store';
import { getDeviceItem } from '@/lib/deviceStore';
import { json, jwt } from '@/test/session';

type ClientModule = typeof import('@/lib/nhost/client');
type LinksModule = typeof import('@/lib/nhost/links');

// The real SDK client, so its own storage side effects happen as on a device.
// It reads `fetch` when it is built, so the stub goes in first.
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
global.fetch = fetchMock as typeof fetch;

const MARKER = 'nhostPasswordReset';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('a reset link on the real client', () => {
  // Anything that follows the session sees it the moment it is stored, so the
  // marker has to be there first or the session would be free to go anywhere.
  it('writes the reset marker before the session, from the bare client', async () => {
    const { nhost } = require('@/lib/nhost/client') as ClientModule;
    const { consumeLink, startFlow } =
      require('@/lib/nhost/links') as LinksModule;
    const mainExchange = jest.spyOn(nhost.auth, 'tokenExchange');
    const mainRefresh = jest.spyOn(nhost.auth, 'refreshToken');
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/v1/token/exchange')
        ? json(
            {
              session: {
                accessToken: jwt(900),
                accessTokenExpiresIn: 900,
                refreshToken: 'session-from-link',
                refreshTokenId: 'refresh-token-id',
                user: { id: 'user-id' },
              },
            },
            200,
          )
        : json({ error: 'unexpected' }, 500),
    );

    const { redirectTo } = await startFlow(
      'passwordReset',
      '/auth/password/reset',
    );
    let markerWhenStored: string | null = null;
    nhost.sessionStorage.onChange(() => {
      markerWhenStored = getDeviceItem(MARKER);
    });
    jest.mocked(SecureStore.setItem).mockClear();

    // As auth sends it: a `/` after the host, then its own parameters.
    const route = await consumeLink(
      `${redirectTo.replace('reset?', 'reset/?')}&code=the-code&type=passwordReset`,
    );

    expect(route).toBe('/auth/password/reset');
    expect(markerWhenStored).toBe('/auth/password/reset');
    const keys = jest
      .mocked(SecureStore.setItem)
      .mock.calls.map(([key]) => key);
    expect(keys.indexOf(MARKER)).toBeGreaterThan(-1);
    expect(keys.indexOf(MARKER)).toBeLessThan(
      keys.findIndex((key) => key.startsWith('nhostSession')),
    );
    expect(mainExchange).not.toHaveBeenCalled();
    expect(mainRefresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/token\/exchange$/);
    expect(JSON.parse(String(init?.body))).toEqual({
      code: 'the-code',
      codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(nhost.getUserSession()?.refreshToken).toBe('session-from-link');
  });
});
