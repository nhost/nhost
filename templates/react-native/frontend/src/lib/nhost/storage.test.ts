import { SessionStorage, type StoredSession } from '@nhost/nhost-js/session';
import * as SecureStore from 'expo-secure-store';
import {
  MAX_SESSION_CHUNKS,
  SECURE_STORE_OPTIONS,
  SESSION_CHUNK_KEYS,
  SESSION_KEY,
  sessionChunkKey,
} from '@/lib/deviceStore';
import {
  MAX_CHUNK_BYTES,
  SecureStoreStorage,
  splitUtf8,
} from '@/lib/nhost/storage';
import { mockDevice } from '@/test/device';
import { jwt, liveSession } from '@/test/session';

const mocked = jest.mocked(SecureStore);
const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

// The largest session the template expects: Hasura claims with a 2 KB custom
// claim, which the SDK stores twice (in the token and decoded), and a display
// name of four-byte characters.
function worstCaseSession(): StoredSession {
  const ids = Array.from(
    { length: 54 },
    (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  );
  const accessToken = jwt(900, {
    iat: Math.floor(Date.now() / 1000),
    iss: 'hasura-auth',
    'https://hasura.io/jwt/claims': {
      'x-hasura-allowed-roles': '{"user","me","editor"}',
      'x-hasura-default-role': 'user',
      'x-hasura-user-id': 'a3b9e4c2-5f1d-4e8a-9b7c-2d6f0e1a3c5b',
      'x-hasura-user-is-anonymous': 'false',
      'x-hasura-org-ids': `{${ids.join(',')}}`,
    },
  });
  let stored: StoredSession | null = null;
  new SessionStorage({
    get: () => stored,
    set: (value) => {
      stored = value;
    },
    remove: () => undefined,
  }).set({
    accessToken,
    accessTokenExpiresIn: 900,
    refreshToken: 'a3b9e4c2-5f1d-4e8a-9b7c-2d6f0e1a3c5b',
    refreshTokenId: 'b4c0f5d3-6a2e-4f9b-8c8d-3e7a1f2b4d6c',
    user: {
      id: 'a3b9e4c2-5f1d-4e8a-9b7c-2d6f0e1a3c5b',
      createdAt: '2026-11-19T10:00:00.000Z',
      displayName: '🦄'.repeat(64),
      avatarUrl: `https://www.gravatar.com/avatar/${'f'.repeat(64)}?d=blank&r=g`,
      locale: 'en',
      email: `${'long.address'.repeat(8)}@example.com`,
      emailVerified: true,
      phoneNumber: '+15555550100',
      phoneNumberVerified: false,
      isAnonymous: false,
      defaultRole: 'user',
      roles: ['user', 'me', 'editor'],
      metadata: { team: 'platform' },
      activeMfaType: 'totp',
    },
  });
  return stored as unknown as StoredSession;
}

// What a fresh process would read, past the instance's cache.
const reread = (): StoredSession | null => new SecureStoreStorage().get();

const chunkValues = (): [string, string | undefined][] =>
  SESSION_CHUNK_KEYS.map((key) => [key, mockDevice().secureStore.get(key)]);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('splitUtf8', () => {
  it('never cuts a character in two', () => {
    const text = `a${'é€🦄'.repeat(50)}`;
    const chunks = splitUtf8(text, 7);

    expect(chunks.join('')).toBe(text);
    for (const chunk of chunks) {
      expect(bytes(chunk)).toBeLessThanOrEqual(7);
      expect(chunk).not.toContain('\uFFFD');
    }
  });
});

describe('SecureStoreStorage', () => {
  it('reads back what it wrote, across processes', () => {
    const session = worstCaseSession();
    new SecureStoreStorage().set(session);

    expect(reread()).toEqual(session);
  });

  it('keeps every value of the largest session within the size limit', () => {
    const session = worstCaseSession();
    new SecureStoreStorage().set(session);

    const header = JSON.parse(mockDevice().secureStore.get(SESSION_KEY) ?? '');
    expect(header.count).toBeGreaterThan(1);
    expect(header.count).toBeLessThanOrEqual(MAX_SESSION_CHUNKS);
    for (const call of mocked.setItem.mock.calls) {
      expect(bytes(call[1])).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
    }
  });

  it('writes each session to the other slot and clears the last one', () => {
    const storage = new SecureStoreStorage();
    storage.set(worstCaseSession());
    const first = JSON.parse(mockDevice().secureStore.get(SESSION_KEY) ?? '');
    const firstKeys = Array.from({ length: first.count }, (_, i) =>
      sessionChunkKey(first.slot, i),
    );

    const next = liveSession({ refreshToken: 'next-token' });
    storage.set(next);
    const second = JSON.parse(mockDevice().secureStore.get(SESSION_KEY) ?? '');

    expect(second.slot).not.toBe(first.slot);
    for (const key of firstKeys) {
      expect(mockDevice().secureStore.get(key)).toBe('');
    }
    // The header is the last write, after the chunks it points to.
    const writes = mocked.setItem.mock.calls.map(([key]) => key);
    const headerAt = writes.lastIndexOf(SESSION_KEY);
    expect(writes.indexOf(sessionChunkKey(second.slot, 0))).toBeLessThan(
      headerAt,
    );
    expect(reread()).toEqual(next);
  });

  it('clears chunks a previous process left behind', () => {
    mockDevice().secureStore.set(sessionChunkKey('b', 3), 'left behind');

    new SecureStoreStorage().set(liveSession());

    expect(mockDevice().secureStore.get(sessionChunkKey('b', 3))).toBe('');
  });

  it('removes a session by clearing every key, never by deleting', async () => {
    jest.useFakeTimers();
    try {
      const storage = new SecureStoreStorage();
      storage.set(worstCaseSession());
      storage.remove();

      expect(storage.get()).toBeNull();
      expect(mockDevice().secureStore.get(SESSION_KEY)).toBe('');
      for (const [, value] of chunkValues()) {
        expect(value ?? '').toBe('');
      }

      // A delete still in flight here would land after this write.
      const next = liveSession({ refreshToken: 'next-token' });
      storage.set(next);
      await jest.runAllTimersAsync();

      expect(reread()).toEqual(next);
      expect(mocked.deleteItemAsync).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ['a header that is not JSON', { [SESSION_KEY]: '{"slot":' }],
    [
      'a header for an unknown slot',
      { [SESSION_KEY]: '{"slot":"c","count":1}' },
    ],
    [
      'a missing chunk',
      {
        [SESSION_KEY]: '{"slot":"a","count":2}',
        [sessionChunkKey('a', 0)]: '{"accessToken"',
      },
    ],
    [
      'chunks that are not a session',
      {
        [SESSION_KEY]: '{"slot":"a","count":1}',
        [sessionChunkKey('a', 0)]: '{"user":{}}',
      },
    ],
  ])('reads %s as no session and clears it', (_, values) => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const [key, value] of Object.entries(values)) {
      mockDevice().secureStore.set(key, value);
    }

    expect(new SecureStoreStorage().get()).toBeNull();
    expect(mockDevice().secureStore.get(SESSION_KEY)).toBe('');
    for (const [, value] of chunkValues()) {
      expect(value ?? '').toBe('');
    }
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('keeps a session the device refused for the rest of the process', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new SecureStoreStorage();
    mocked.setItem.mockImplementationOnce(() => {
      throw new Error('keychain unavailable');
    });

    const session = liveSession();
    storage.set(session);

    expect(storage.get()).toBe(session);
    expect(reread()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      'Could not keep the session on the device:',
      expect.any(Error),
    );
    error.mockRestore();
  });

  it('passes the shared options on every call', () => {
    const storage = new SecureStoreStorage();
    storage.get();
    storage.set(worstCaseSession());
    storage.set(liveSession());
    storage.remove();

    const calls = [...mocked.getItem.mock.calls, ...mocked.setItem.mock.calls];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.at(-1)).toBe(SECURE_STORE_OPTIONS);
    }
  });
});

// `jest.setup.ts` fails any test that hands SecureStore a key the reinstall
// wipe would not find, or other options.
describe('the SecureStore check', () => {
  it('catches a key outside the fixed set and other options', () => {
    SecureStore.setItem('elsewhere', 'value', SECURE_STORE_OPTIONS);
    SecureStore.getItem(SESSION_KEY, { keychainService: 'other' });

    expect(mockDevice().violations.splice(0)).toEqual([
      'elsewhere is not in SECURE_STORE_KEYS',
      `${SESSION_KEY} was used with other options`,
    ]);
  });
});
