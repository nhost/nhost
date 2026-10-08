import type { StoredSession } from '@nhost/nhost-js/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

// The real module needs a device. Only the three calls this uses are stood up.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

const { AsyncSessionStorage, SESSION_KEY } = await import(
  '@/lib/nhost/storage'
);

const session = { accessToken: 'a', refreshToken: 'r' } as StoredSession;

describe('AsyncSessionStorage', () => {
  beforeEach(() => {
    store.clear();
  });

  // The SDK reads the session synchronously, so a write has to be visible to
  // the next `get` without waiting for the disk.
  it('reads back a session it has just been given, without awaiting', () => {
    const storage = new AsyncSessionStorage();

    storage.set(session);

    expect(storage.get()).toEqual(session);
  });

  it('starts empty and clears on remove', async () => {
    const storage = new AsyncSessionStorage();

    expect(storage.get()).toBeNull();

    storage.set(session);
    storage.remove();

    expect(storage.get()).toBeNull();
    await vi.waitFor(() => expect(store.has(SESSION_KEY)).toBe(false));
  });

  // What makes the session survive the app being closed: one instance writes
  // it, and the next launch's instance hydrates it back.
  it('hydrates what a previous launch stored', async () => {
    new AsyncSessionStorage().set(session);
    await vi.waitFor(() => expect(store.has(SESSION_KEY)).toBe(true));

    const next = new AsyncSessionStorage();
    await next.hydrate();

    expect(next.get()).toEqual(session);
  });

  // A session written by an older version of the app, or a half-written one,
  // has to land the user at signed out rather than at a crash on launch.
  it('drops an unreadable stored session instead of throwing', async () => {
    store.set(SESSION_KEY, '{not json');

    const storage = new AsyncSessionStorage();
    await storage.hydrate();

    expect(storage.get()).toBeNull();
  });
});
