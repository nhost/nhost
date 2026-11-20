import './src/lib/polyfills';
import { SECURE_STORE_KEYS, SECURE_STORE_OPTIONS } from '@/lib/deviceStore';
import { installMarker } from '@/lib/install';
import type { MockDevice } from '@/test/device';

const mockDevice: MockDevice = {
  secureStore: new Map(),
  files: new Set(),
  violations: [],
};

// Every key must come from the fixed set, which the reinstall wipe walks, and
// every call must pass the shared options, which pick the keychain item.
function mockCheck(key: string, options: unknown): void {
  if (!SECURE_STORE_KEYS.includes(key)) {
    mockDevice.violations.push(`${key} is not in SECURE_STORE_KEYS`);
  }
  if (JSON.stringify(options) !== JSON.stringify(SECURE_STORE_OPTIONS)) {
    mockDevice.violations.push(`${key} was used with other options`);
  }
}

// The factories run while the imports above load, before `mockDevice` is
// assigned, so they reach it only from functions.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  get mockDevice() {
    return mockDevice;
  },
  getItem: jest.fn((key: string, options?: unknown) => {
    mockCheck(key, options);
    return mockDevice.secureStore.get(key) ?? null;
  }),
  setItem: jest.fn((key: string, value: string, options?: unknown) => {
    mockCheck(key, options);
    mockDevice.secureStore.set(key, value);
  }),
  // Resolves late, as the native delete can, after any write made meanwhile.
  deleteItemAsync: jest.fn(async (key: string) => {
    mockDevice.violations.push(`deleteItemAsync(${key}) was called`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    mockDevice.secureStore.delete(key);
  }),
}));

// expo-crypto's own mock returns nothing; Node's crypto stands in for the
// native module.
jest.mock('expo-crypto', () => {
  const { createHash, randomBytes } =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...jest.requireActual('expo-crypto'),
    getRandomBytes: (count: number) => new Uint8Array(randomBytes(count)),
    digestStringAsync: async (
      algorithm: string,
      data: string,
      options?: { encoding?: string },
    ) =>
      createHash(algorithm.replace('-', '').toLowerCase())
        .update(data, 'utf8')
        .digest(options?.encoding === 'base64' ? 'base64' : 'hex'),
  };
});

jest.mock('expo-file-system', () => {
  const uriOf = (part: string | { uri: string }): string =>
    typeof part === 'string' ? part : part.uri;

  class File {
    readonly uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map(uriOf).join('/');
    }

    get exists(): boolean {
      return mockDevice.files.has(this.uri);
    }

    create(): void {
      if (this.exists) {
        throw new Error(`${this.uri} already exists`);
      }
      mockDevice.files.add(this.uri);
    }
  }

  return {
    ...jest.requireActual('expo-file-system'),
    File,
    Paths: { document: { uri: 'file:///document' } },
  };
});

// Tests start on an installed app with nothing stored.
beforeEach(() => {
  mockDevice.secureStore.clear();
  mockDevice.files.clear();
  mockDevice.violations.length = 0;
  installMarker().create();
});

afterEach(() => {
  if (mockDevice.violations.length > 0) {
    throw new Error(
      `SecureStore misuse:\n${mockDevice.violations.splice(0).join('\n')}`,
    );
  }
});
