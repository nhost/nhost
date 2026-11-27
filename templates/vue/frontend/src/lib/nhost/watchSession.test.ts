// @vitest-environment happy-dom
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckedSession } from '@/lib/nhost/client';
import {
  FOCUS_REFRESH_MS,
  type SessionWatcher,
  watchSession,
} from '@/lib/nhost/watchSession';

const fake = vi.hoisted(() => ({
  session: null as StoredSession | null,
  subscribers: new Set<(session: StoredSession | null) => void>(),
  checkSession: vi.fn<(session: StoredSession) => Promise<CheckedSession>>(),
}));

vi.mock('@/lib/nhost/client', () => ({
  nhost: {
    getUserSession: () => fake.session,
    sessionStorage: {
      remove: () => {
        fake.session = null;
        for (const notify of fake.subscribers) {
          notify(null);
        }
      },
      onChange: (callback: (session: StoredSession | null) => void) => {
        fake.subscribers.add(callback);
        return () => fake.subscribers.delete(callback);
      },
    },
  },
  checkSession: fake.checkSession,
}));

const MARKER = 'nhostPasswordReset';

const session = (userId = 'user-1', refreshTokenId = 'id-1') =>
  ({ refreshTokenId, user: { id: userId } }) as StoredSession;

const callbacks = {
  onSession: vi.fn(),
  onRecheck: vi.fn(),
  onRefresh: vi.fn(),
};

// What another tab's write looks like from this one: the value is already in
// storage when the event arrives.
function otherTabWrites(
  key: string | null,
  oldValue: StoredSession | string | null,
  newValue: StoredSession | null,
): void {
  if (key === DEFAULT_SESSION_KEY || key === null) {
    fake.session = newValue;
  }
  const raw = (value: StoredSession | string | null) =>
    value === null || typeof value === 'string' ? value : JSON.stringify(value);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key,
      oldValue: raw(oldValue),
      newValue: raw(newValue),
      storageArea: localStorage,
    }),
  );
}

let watcher: SessionWatcher;

beforeEach(() => {
  localStorage.clear();
  fake.session = null;
  fake.subscribers.clear();
  fake.checkSession.mockReset();
  fake.checkSession.mockResolvedValue('live');
  for (const callback of Object.values(callbacks)) {
    callback.mockReset();
  }
});

afterEach(() => {
  watcher.stop();
  vi.useRealTimers();
});

describe('watchSession, other tabs', () => {
  it('follows a sign-in in another tab and reloads for the new user', () => {
    watcher = watchSession(callbacks);

    otherTabWrites(DEFAULT_SESSION_KEY, null, session());

    expect(callbacks.onSession).toHaveBeenLastCalledWith(session());
    expect(callbacks.onRecheck).toHaveBeenCalledOnce();
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
  });

  it('reloads when another tab signs in as somebody else', () => {
    fake.session = session('user-1');
    watcher = watchSession(callbacks);

    otherTabWrites(DEFAULT_SESSION_KEY, session('user-1'), session('user-2'));

    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
  });

  // Every tab refreshes the same session, which keeps its id.
  it('only rechecks when another tab refreshed the same session', () => {
    fake.session = session();
    watcher = watchSession(callbacks);

    otherTabWrites(DEFAULT_SESSION_KEY, session(), session());

    expect(callbacks.onRecheck).toHaveBeenCalledOnce();
    expect(callbacks.onRefresh).not.toHaveBeenCalled();
  });

  it('follows a sign-out in another tab and drops the reset marker', () => {
    fake.session = session();
    localStorage.setItem(MARKER, '/auth/password/reset');
    watcher = watchSession(callbacks);

    otherTabWrites(DEFAULT_SESSION_KEY, session(), null);

    expect(callbacks.onSession).toHaveBeenLastCalledWith(null);
    expect(callbacks.onRecheck).toHaveBeenCalledOnce();
    expect(localStorage.getItem(MARKER)).toBeNull();
  });

  it('treats storage cleared in another tab as a sign-out', () => {
    fake.session = session();
    watcher = watchSession(callbacks);

    otherTabWrites(null, null, null);

    expect(callbacks.onSession).toHaveBeenLastCalledWith(null);
    expect(callbacks.onRecheck).toHaveBeenCalledOnce();
  });

  // The marker's own event says a reset started or ended, never that the
  // session did.
  it('rechecks on a reset marker from another tab and keeps it', () => {
    fake.session = session();
    watcher = watchSession(callbacks);

    localStorage.setItem(MARKER, '/auth/password/reset');
    otherTabWrites(MARKER, null, null);

    expect(callbacks.onRecheck).toHaveBeenCalledOnce();
    expect(callbacks.onSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(MARKER)).toBe('/auth/password/reset');
  });

  it('ignores every other key', () => {
    watcher = watchSession(callbacks);

    otherTabWrites('nhostLastSignIn', null, null);

    expect(callbacks.onRecheck).not.toHaveBeenCalled();
  });
});

describe('watchSession, this tab', () => {
  it('passes a sign-out on and drops the reset marker', () => {
    fake.session = session();
    localStorage.setItem(MARKER, '/auth/password/reset');
    watcher = watchSession(callbacks);

    for (const notify of fake.subscribers) {
      notify(null);
    }

    expect(callbacks.onSession).toHaveBeenCalledWith(null);
    expect(localStorage.getItem(MARKER)).toBeNull();
    expect(callbacks.onRecheck).not.toHaveBeenCalled();
  });
});

// An access token outlives a revoked session, so each navigation asks.
describe('watchSession, revoked sessions', () => {
  it('signs out a session revoked elsewhere and rechecks', async () => {
    fake.session = session();
    fake.checkSession.mockResolvedValue('revoked');
    watcher = watchSession(callbacks);

    await watcher.checkRevoked();

    expect(fake.checkSession).toHaveBeenCalledWith(session());
    expect(fake.session).toBeNull();
    expect(callbacks.onRecheck).toHaveBeenCalledOnce();
  });

  it('keeps a session another tab started while the check ran', async () => {
    fake.session = session('user-1', 'id-1');
    fake.checkSession.mockImplementation(async () => {
      fake.session = session('user-1', 'id-2');
      return 'revoked';
    });
    watcher = watchSession(callbacks);

    await watcher.checkRevoked();

    expect(fake.session).toEqual(session('user-1', 'id-2'));
    expect(callbacks.onRecheck).not.toHaveBeenCalled();
  });

  it('runs one check at a time', async () => {
    fake.session = session();
    watcher = watchSession(callbacks);

    const first = watcher.checkRevoked();
    const second = watcher.checkRevoked();
    await Promise.all([first, second]);
    await watcher.checkRevoked();

    expect(second).toBe(first);
    expect(fake.checkSession).toHaveBeenCalledTimes(2);
  });

  it('asks nothing without a session', async () => {
    watcher = watchSession(callbacks);

    await watcher.checkRevoked();

    expect(fake.checkSession).not.toHaveBeenCalled();
  });
});

// A tab left open never navigates, so coming back to it is what notices a
// session revoked from another device.
describe('watchSession, returning to the tab', () => {
  const returnToTab = async (): Promise<void> => {
    window.dispatchEvent(new Event('focus'));
    await new Promise((resolve) => setTimeout(resolve));
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  it('checks and reloads a signed-in tab returned to after a while', async () => {
    fake.session = session();
    watcher = watchSession(callbacks);

    vi.advanceTimersByTime(FOCUS_REFRESH_MS);
    await returnToTab();

    expect(fake.checkSession).toHaveBeenCalledOnce();
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
  });

  it('leaves a tab returned to soon after alone', async () => {
    fake.session = session();
    watcher = watchSession(callbacks);

    vi.advanceTimersByTime(FOCUS_REFRESH_MS - 1);
    await returnToTab();

    expect(fake.checkSession).not.toHaveBeenCalled();
    expect(callbacks.onRefresh).not.toHaveBeenCalled();
  });

  it('leaves a signed-out tab alone', async () => {
    watcher = watchSession(callbacks);

    vi.advanceTimersByTime(FOCUS_REFRESH_MS);
    await returnToTab();

    expect(callbacks.onRefresh).not.toHaveBeenCalled();
  });
});
