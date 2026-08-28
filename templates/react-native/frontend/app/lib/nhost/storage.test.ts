import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
}));

const { NhostAsyncStorage } = await import('./storage');

const session = {
  accessToken: 'header.payload.signature',
  refreshToken: 'refresh-token',
  refreshTokenId: 'refresh-token-id',
} as unknown as StoredSession;

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('NhostAsyncStorage', () => {
  it('returns null before anything is stored', () => {
    expect(new NhostAsyncStorage().get()).toBeNull();
  });

  it('caches the session synchronously on set and clears it on remove', () => {
    const storage = new NhostAsyncStorage();

    storage.set(session);
    expect(storage.get()).toEqual(session);

    storage.remove();
    expect(storage.get()).toBeNull();
  });

  it('hydrates the cached session from AsyncStorage on construction', async () => {
    store.set(DEFAULT_SESSION_KEY, JSON.stringify(session));

    const storage = new NhostAsyncStorage();
    // hydrate() reads AsyncStorage asynchronously; wait a tick for the cache.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(storage.get()).toEqual(session);
  });
});
