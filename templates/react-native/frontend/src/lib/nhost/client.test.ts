import type { StoredSession } from '@nhost/nhost-js/session';
import { SESSION_KEY } from '@/lib/deviceStore';
import { ProcessLockManager } from '@/lib/locks';
import { SecureStoreStorage } from '@/lib/nhost/storage';
import { mockDevice } from '@/test/device';
import { json, jwt, liveSession } from '@/test/session';

type Client = typeof import('@/lib/nhost/client');

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
global.fetch = fetchMock as typeof fetch;

// A fresh process: the client module and the SDK load again over what the
// device already holds.
function loadClient(stored?: object): Client {
  if (stored) {
    new SecureStoreStorage().set(stored as StoredSession);
  }
  let client: Client | undefined;
  jest.isolateModules(() => {
    client = require('@/lib/nhost/client');
  });
  return client as Client;
}

const call = (index: number) => ({
  url: String(fetchMock.mock.calls[index][0]),
  init: fetchMock.mock.calls[index][1],
});

const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path));

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getVerifiedUser', () => {
  // A session the auth service did not issue, with an expiry an hour out so
  // nothing tries to refresh it, and somebody else's user.
  it('rejects a stored session with a forged expiry', async () => {
    const { getVerifiedUser } = loadClient({
      accessToken: 'not-a-jwt',
      refreshToken: '00000000-0000-0000-0000-000000000000',
      decodedToken: { exp: Date.now() + 60 * 60 * 1000 },
      user: { id: 'victim-id', email: 'admin@example.com' },
    });
    fetchMock.mockResolvedValue(
      json({ error: 'invalid-token', message: 'Invalid token' }, 401),
    );

    expect(await getVerifiedUser()).toEqual({ user: null, reason: 'rejected' });
    expect(call(0).url).toMatch(/\/v1\/user$/);
    expect(new Headers(call(0).init?.headers).get('Authorization')).toBe(
      'Bearer not-a-jwt',
    );
  });

  // An outage is not a reason to sign anyone out.
  it('tells a failure to answer apart from a refusal', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getVerifiedUser } = loadClient(liveSession());
    fetchMock.mockResolvedValue(json({ error: 'internal' }, 500));

    expect(await getVerifiedUser()).toEqual({
      user: null,
      reason: 'unavailable',
    });
  });

  it('asks nothing without a session', async () => {
    const { getVerifiedUser } = loadClient();

    expect(await getVerifiedUser()).toEqual({
      user: null,
      reason: 'signed-out',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// An access token stays valid for its whole life after the session is
// revoked, so the app asks whether the refresh token's row is still there.
describe('checkSession', () => {
  const graphqlBody = (): { variables: object } =>
    JSON.parse(String(call(0).init?.body));

  it('calls a session whose row is gone revoked', async () => {
    const live = liveSession();
    const { checkSession } = loadClient(live);
    fetchMock.mockResolvedValue(
      json({ data: { authRefreshToken: null } }, 200),
    );

    expect(await checkSession(live)).toBe('revoked');
    expect(graphqlBody().variables).toEqual({ id: 'refresh-token-id' });
  });

  it('calls a session it cannot check unknown', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const live = liveSession();
    const { checkSession } = loadClient(live);

    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await checkSession(live)).toBe('unknown');

    fetchMock.mockResolvedValueOnce(
      json({ errors: [{ message: 'field not found in type' }] }, 200),
    );
    expect(await checkSession(live)).toBe('unknown');

    expect(await checkSession({ ...live, refreshTokenId: '' })).toBe('unknown');
  });
});

describe('bareAuth', () => {
  // The main client would clear the stored session on any /signout.
  it('signs a token out and leaves the stored session alone', async () => {
    const { bareAuth, nhost } = loadClient(liveSession());
    fetchMock.mockResolvedValue(json('OK', 200));

    await bareAuth().signOut({ refreshToken: 'other-token' });

    expect(call(0).url).toMatch(/\/v1\/signout$/);
    expect(JSON.parse(String(call(0).init?.body))).toEqual({
      refreshToken: 'other-token',
    });
    expect(nhost.getUserSession()?.refreshToken).toBe('refresh-token');
  });
});

describe('updateSessionUser', () => {
  it('rewrites the stored user and nothing else', () => {
    const { nhost, updateSessionUser } = loadClient(liveSession());

    updateSessionUser({ displayName: 'Grace' });

    expect(nhost.getUserSession()).toMatchObject({
      refreshToken: 'refresh-token',
      user: { id: 'user-id', displayName: 'Grace' },
    });
    expect(new SecureStoreStorage().get()?.user?.displayName).toBe('Grace');
  });
});

describe('after a reinstall', () => {
  beforeEach(() => {
    mockDevice().files.clear();
  });

  it('clears the previous session before the client is created', () => {
    let headerAtCreate: string | undefined;
    jest.doMock('@nhost/nhost-js', () => {
      const actual = jest.requireActual('@nhost/nhost-js');
      return {
        ...actual,
        createClient: (options: object) => {
          headerAtCreate = mockDevice().secureStore.get(SESSION_KEY);
          return actual.createClient(options);
        },
      };
    });
    fetchMock.mockReturnValue(new Promise(() => undefined));

    try {
      const { nhost } = loadClient(liveSession({ refreshToken: 'old-token' }));

      expect(headerAtCreate).toBe('');
      expect(nhost.getUserSession()).toBeNull();
    } finally {
      jest.dontMock('@nhost/nhost-js');
    }
  });

  // Not awaited: the revoke is still in flight when the client is used.
  it('revokes the previous session on the bare client', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    const { nhost } = loadClient(liveSession({ refreshToken: 'old-token' }));
    await Promise.resolve();

    expect(nhost.getUserSession()).toBeNull();
    expect(call(0).url).toMatch(/\/v1\/signout$/);
    expect(JSON.parse(String(call(0).init?.body))).toEqual({
      refreshToken: 'old-token',
    });
    expect(new Headers(call(0).init?.headers).has('Authorization')).toBe(false);
  });
});

// Refresh tokens are single use. Two refreshes that overlap must not both
// spend the stored one: the loser's 401 makes the SDK clear the session.
describe('refreshSession', () => {
  const expiring = () =>
    liveSession({
      accessToken: jwt(30),
      decodedToken: { exp: Date.now() + 30 * 1000 },
    });

  const answerRefresh = () =>
    fetchMock.mockImplementation(async (url) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (!String(url).endsWith('/v1/token')) {
        return json({}, 404);
      }
      return json(
        {
          accessToken: jwt(900),
          accessTokenExpiresIn: 900,
          refreshToken: 'next-token',
          refreshTokenId: 'next-token-id',
          user: { id: 'user-id', displayName: 'Ada' },
        },
        200,
      );
    });

  it('runs under the in-process lock the SDK picked up when it loaded', async () => {
    const request = jest.spyOn(navigator.locks, 'request');
    const { nhost } = loadClient(expiring());
    answerRefresh();

    expect(navigator.locks).toBeInstanceOf(ProcessLockManager);
    await nhost.refreshSession(60);
    expect(request).toHaveBeenCalledWith(
      'nhostSessionLock',
      { mode: 'exclusive' },
      expect.any(Function),
    );
  });

  it('spends the refresh token once for two concurrent refreshes', async () => {
    const { nhost } = loadClient(expiring());
    answerRefresh();

    const sessions = await Promise.all([
      nhost.refreshSession(60),
      nhost.refreshSession(60),
    ]);

    const refreshes = callsTo('/v1/token');
    expect(refreshes).toHaveLength(1);
    expect(JSON.parse(String(refreshes[0][1]?.body))).toEqual({
      refreshToken: 'refresh-token',
    });
    expect(sessions.map((s) => s?.refreshToken)).toEqual([
      'next-token',
      'next-token',
    ]);
    expect(new SecureStoreStorage().get()?.refreshToken).toBe('next-token');
  });

  // What the lock prevents: without `navigator.locks` the SDK falls back to a
  // lock that does nothing.
  it('spends it twice without the lock', async () => {
    const locks = navigator.locks;
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
    });
    try {
      const { nhost } = loadClient(expiring());
      answerRefresh();

      await Promise.all([nhost.refreshSession(60), nhost.refreshSession(60)]);

      expect(callsTo('/v1/token')).toHaveLength(2);
    } finally {
      Object.defineProperty(navigator, 'locks', {
        value: locks,
        configurable: true,
      });
    }
  });
});
