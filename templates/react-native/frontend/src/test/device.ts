/**
 * The in-memory keychain and file system `jest.setup.ts` puts behind
 * expo-secure-store and expo-file-system. It outlives `jest.resetModules()`,
 * as the device outlives the app, and is reset before every test.
 */
export interface MockDevice {
  /** SecureStore values by key. */
  secureStore: Map<string, string>;
  /** URIs of the files that exist. */
  files: Set<string>;
  /** Misuses found during the current test, which fail it. */
  violations: string[];
}

export function mockDevice(): MockDevice {
  return jest.requireMock<{ mockDevice: MockDevice }>('expo-secure-store')
    .mockDevice;
}
