import type { StoredSession } from '@nhost/nhost-js/session';
import { AppState, type AppStateStatus } from 'react-native';
import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import type { CheckedSession } from '@/lib/nhost/client';
import {
  FOCUS_REFRESH_MS,
  type SessionWatcher,
  watchSession,
} from '@/lib/nhost/watchSession';

const mockFake = {
  session: null as StoredSession | null,
  subscribers: new Set<(session: StoredSession | null) => void>(),
  checkSession: jest.fn<Promise<CheckedSession>, [StoredSession]>(),
};

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    getUserSession: () => mockFake.session,
    sessionStorage: {
      remove: () => {
        mockFake.session = null;
        for (const notify of mockFake.subscribers) {
          notify(null);
        }
      },
      onChange: (callback: (session: StoredSession | null) => void) => {
        mockFake.subscribers.add(callback);
        return () => mockFake.subscribers.delete(callback);
      },
    },
  },
  checkSession: (session: StoredSession) => mockFake.checkSession(session),
}));

const MARKER = 'nhostPasswordReset';

const session = (userId = 'user-1', refreshTokenId = 'id-1') =>
  ({ refreshTokenId, user: { id: userId } }) as StoredSession;

const callbacks = {
  onSession: jest.fn(),
  onRevoked: jest.fn(),
  onRefresh: jest.fn(),
};

const appStateListeners = new Set<(state: AppStateStatus) => void>();

let watcher: SessionWatcher;

beforeEach(() => {
  mockFake.session = null;
  mockFake.subscribers.clear();
  mockFake.checkSession.mockReset();
  mockFake.checkSession.mockResolvedValue('live');
  for (const callback of Object.values(callbacks)) {
    callback.mockReset();
  }
  appStateListeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    appStateListeners.add(handler);
    return { remove: () => appStateListeners.delete(handler) };
  });
});

afterEach(() => {
  watcher.stop();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('watchSession, this app', () => {
  it('passes a sign-out on and drops the reset marker', () => {
    mockFake.session = session();
    setDeviceItem(MARKER, '/auth/password/reset');
    watcher = watchSession(callbacks);

    for (const notify of mockFake.subscribers) {
      notify(null);
    }

    expect(callbacks.onSession).toHaveBeenCalledWith(null);
    expect(getDeviceItem(MARKER)).toBeNull();
    expect(callbacks.onRevoked).not.toHaveBeenCalled();
  });

  it('passes a sign-in on and keeps the reset marker', () => {
    setDeviceItem(MARKER, '/auth/password/reset');
    watcher = watchSession(callbacks);

    for (const notify of mockFake.subscribers) {
      notify(session());
    }

    expect(callbacks.onSession).toHaveBeenCalledWith(session());
    expect(getDeviceItem(MARKER)).toBe('/auth/password/reset');
  });

  it('stops following when stopped', () => {
    watcher = watchSession(callbacks);

    watcher.stop();

    expect(mockFake.subscribers.size).toBe(0);
    expect(appStateListeners.size).toBe(0);
  });
});

// An access token outlives a revoked session, so each navigation asks.
describe('watchSession, revoked sessions', () => {
  it('signs out a session revoked elsewhere and says so', async () => {
    mockFake.session = session();
    mockFake.checkSession.mockResolvedValue('revoked');
    watcher = watchSession(callbacks);

    await watcher.checkRevoked();

    expect(mockFake.checkSession).toHaveBeenCalledWith(session());
    expect(mockFake.session).toBeNull();
    expect(callbacks.onRevoked).toHaveBeenCalledTimes(1);
  });

  it('keeps a session that replaced the checked one meanwhile', async () => {
    mockFake.session = session('user-1', 'id-1');
    mockFake.checkSession.mockImplementation(async () => {
      mockFake.session = session('user-1', 'id-2');
      return 'revoked';
    });
    watcher = watchSession(callbacks);

    await watcher.checkRevoked();

    expect(mockFake.session).toEqual(session('user-1', 'id-2'));
    expect(callbacks.onRevoked).not.toHaveBeenCalled();
  });

  it('runs one check at a time', async () => {
    mockFake.session = session();
    watcher = watchSession(callbacks);

    const first = watcher.checkRevoked();
    const second = watcher.checkRevoked();
    await Promise.all([first, second]);
    await watcher.checkRevoked();

    expect(second).toBe(first);
    expect(mockFake.checkSession).toHaveBeenCalledTimes(2);
  });

  it('asks nothing without a session', async () => {
    watcher = watchSession(callbacks);

    await watcher.checkRevoked();

    expect(mockFake.checkSession).not.toHaveBeenCalled();
  });
});

// An app left open on one screen never navigates, so coming back to it is
// what notices a session revoked from another device.
describe('watchSession, returning to the app', () => {
  const appBecomes = async (state: AppStateStatus): Promise<void> => {
    for (const listener of appStateListeners) {
      listener(state);
    }
    await new Promise(process.nextTick);
  };

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  it('checks and reloads a signed-in app returned to after a while', async () => {
    mockFake.session = session();
    watcher = watchSession(callbacks);

    jest.advanceTimersByTime(FOCUS_REFRESH_MS);
    await appBecomes('background');
    await appBecomes('active');

    expect(mockFake.checkSession).toHaveBeenCalledTimes(1);
    expect(callbacks.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('signs out a session revoked while the app was away', async () => {
    mockFake.session = session();
    mockFake.checkSession.mockResolvedValue('revoked');
    watcher = watchSession(callbacks);

    jest.advanceTimersByTime(FOCUS_REFRESH_MS);
    await appBecomes('active');

    expect(callbacks.onRevoked).toHaveBeenCalledTimes(1);
    expect(callbacks.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('leaves an app returned to soon after alone', async () => {
    mockFake.session = session();
    watcher = watchSession(callbacks);

    jest.advanceTimersByTime(FOCUS_REFRESH_MS - 1);
    await appBecomes('active');

    expect(mockFake.checkSession).not.toHaveBeenCalled();
    expect(callbacks.onRefresh).not.toHaveBeenCalled();
  });

  it('checks again only after another while', async () => {
    mockFake.session = session();
    watcher = watchSession(callbacks);

    jest.advanceTimersByTime(FOCUS_REFRESH_MS);
    await appBecomes('active');
    jest.advanceTimersByTime(FOCUS_REFRESH_MS - 1);
    await appBecomes('active');

    expect(mockFake.checkSession).toHaveBeenCalledTimes(1);
  });

  it('ignores the app going to the background', async () => {
    mockFake.session = session();
    watcher = watchSession(callbacks);

    jest.advanceTimersByTime(FOCUS_REFRESH_MS);
    await appBecomes('inactive');
    await appBecomes('background');

    expect(mockFake.checkSession).not.toHaveBeenCalled();
  });

  it('leaves a signed-out app alone', async () => {
    watcher = watchSession(callbacks);

    jest.advanceTimersByTime(FOCUS_REFRESH_MS);
    await appBecomes('active');

    expect(callbacks.onRefresh).not.toHaveBeenCalled();
  });
});
