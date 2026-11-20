import type { StoredSession } from '@nhost/nhost-js/session';
import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import type { CheckedSession } from '@/lib/nhost/client';

const mockFake = {
  session: null as StoredSession | null,
  calls: [] as string[],
  refreshSession: jest.fn<Promise<unknown>, [number?]>(),
  checkSession: jest.fn<Promise<CheckedSession>, [StoredSession]>(),
};

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    refreshSession: (margin?: number) => {
      mockFake.calls.push('refresh');
      return mockFake.refreshSession(margin);
    },
    getUserSession: () => mockFake.session,
    sessionStorage: {
      remove: () => {
        mockFake.calls.push('remove');
        mockFake.session = null;
      },
    },
  },
  checkSession: (session: StoredSession) => {
    mockFake.calls.push('check');
    return mockFake.checkSession(session);
  },
}));

const MARKER = 'nhostPasswordReset';

const session = (refreshTokenId = 'id-1') =>
  ({ refreshToken: 'stored', refreshTokenId }) as StoredSession;

// A fresh module per test: the promise it holds is once per launch.
function load(): typeof import('@/lib/nhost/startSession') {
  let module: typeof import('@/lib/nhost/startSession') | undefined;
  jest.isolateModules(() => {
    module = require('@/lib/nhost/startSession');
  });
  return module as typeof import('@/lib/nhost/startSession');
}

const start = (): Promise<void> => load().startSession();

// What the SDK's refresh does with a stored session the auth service rejects.
const rejectRefresh = async () => {
  mockFake.session = null;
  return null;
};

beforeEach(() => {
  mockFake.session = null;
  mockFake.calls = [];
  mockFake.refreshSession.mockReset();
  mockFake.checkSession.mockReset();
  mockFake.refreshSession.mockImplementation(async () => mockFake.session);
  mockFake.checkSession.mockResolvedValue('live');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('startSession', () => {
  it('refreshes, then asks whether the session was revoked', async () => {
    mockFake.session = session();
    mockFake.checkSession.mockResolvedValue('revoked');

    await start();

    expect(mockFake.calls).toEqual(['refresh', 'check', 'remove']);
    expect(mockFake.refreshSession).toHaveBeenCalledWith(60);
    expect(mockFake.checkSession).toHaveBeenCalledWith(session());
  });

  it('resolves once however often it is called', async () => {
    const { startSession } = load();

    const first = startSession();
    expect(startSession()).toBe(first);
    await first;

    expect(mockFake.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('resolves even when everything fails', async () => {
    mockFake.session = session();
    mockFake.refreshSession.mockRejectedValue(new TypeError('fetch failed'));

    await expect(start()).resolves.toBeUndefined();
    expect(mockFake.session).toEqual(session());
  });

  it('asks nothing more of a session the auth service refused', async () => {
    mockFake.session = session();
    mockFake.refreshSession.mockImplementation(rejectRefresh);

    await start();

    expect(mockFake.checkSession).not.toHaveBeenCalled();
    expect(mockFake.session).toBeNull();
  });
});

describe('startSession, an outage', () => {
  // An outage is not a sign-out: the SDK keeps the session and so does this.
  it('keeps the session when the refresh fails for another reason', async () => {
    mockFake.session = session();
    mockFake.refreshSession.mockResolvedValue(null);
    mockFake.checkSession.mockResolvedValue('unknown');

    await start();

    expect(mockFake.session).toEqual(session());
  });

  // React Native's fetch never gives up, and the splash waits on this.
  it('gives up on a network that never answers and keeps the session', async () => {
    jest.useFakeTimers();
    mockFake.session = session();
    setDeviceItem(MARKER, '/auth/password/reset');
    mockFake.refreshSession.mockReturnValue(new Promise(() => undefined));
    let settled = false;

    const started = start().then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await started;

    expect(mockFake.session).toEqual(session());
    expect(mockFake.checkSession).not.toHaveBeenCalled();
    expect(getDeviceItem(MARKER)).toBe('/auth/password/reset');
  });

  it('keeps a session it cannot check', async () => {
    mockFake.session = session();
    mockFake.checkSession.mockResolvedValue('unknown');

    await start();

    expect(mockFake.session).toEqual(session());
  });

  it('keeps a session that replaced the checked one meanwhile', async () => {
    mockFake.session = session('id-1');
    mockFake.checkSession.mockImplementation(async () => {
      mockFake.session = session('id-3');
      return 'revoked';
    });

    await start();

    expect(mockFake.session).toEqual(session('id-3'));
  });
});

describe('startSession, a password reset', () => {
  // The reset session expired; the marker it left must not hold the next
  // session to the reset screen.
  it('drops a marker left behind by a session that is gone', async () => {
    setDeviceItem(MARKER, '/auth/password/reset');
    mockFake.session = session();
    mockFake.refreshSession.mockImplementation(rejectRefresh);

    await start();

    expect(getDeviceItem(MARKER)).toBeNull();
  });

  it('drops the marker with a session revoked elsewhere', async () => {
    setDeviceItem(MARKER, '/auth/password/reset');
    mockFake.session = session();
    mockFake.checkSession.mockResolvedValue('revoked');

    await start();

    expect(getDeviceItem(MARKER)).toBeNull();
  });

  // Confined across a kill and relaunch until the new password is saved.
  it('keeps the marker while its session lives', async () => {
    setDeviceItem(MARKER, '/auth/password/reset');
    mockFake.session = session();

    await start();

    expect(getDeviceItem(MARKER)).toBe('/auth/password/reset');
  });
});
