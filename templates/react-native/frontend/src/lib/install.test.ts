import * as SecureStore from 'expo-secure-store';
import {
  DEVICE_KEYS,
  SECURE_STORE_KEYS,
  SECURE_STORE_OPTIONS,
  SESSION_KEY,
  setDeviceItem,
} from '@/lib/deviceStore';
import { clearAfterReinstall, installMarker } from '@/lib/install';
import { SecureStoreStorage } from '@/lib/nhost/storage';
import { mockDevice } from '@/test/device';
import { liveSession } from '@/test/session';

const mocked = jest.mocked(SecureStore);

function storeEverything(): void {
  new SecureStoreStorage().set(liveSession({ refreshToken: 'old-token' }));
  for (const key of DEVICE_KEYS) {
    setDeviceItem(key, 'old');
  }
}

describe('clearAfterReinstall', () => {
  // The iOS keychain outlives an uninstall; the marker file does not.
  it('clears every key on the first launch, the session header first', () => {
    storeEverything();
    mockDevice().files.clear();
    jest.clearAllMocks();
    const revoke = jest.fn(() => new Promise<void>(() => undefined));

    clearAfterReinstall(revoke);

    for (const key of SECURE_STORE_KEYS) {
      expect(mockDevice().secureStore.get(key) ?? '').toBe('');
    }
    const cleared = mocked.setItem.mock.calls.filter(([, v]) => v === '');
    expect(cleared[0]).toEqual([SESSION_KEY, '', SECURE_STORE_OPTIONS]);
    expect(new Set(cleared.map(([key]) => key))).toEqual(
      new Set(SECURE_STORE_KEYS),
    );
    // Returned with the revoke still pending.
    expect(revoke).toHaveBeenCalledWith('old-token');
    expect(installMarker().exists).toBe(true);
  });

  it('revokes nothing when nothing was stored', () => {
    mockDevice().files.clear();
    const revoke = jest.fn(async () => undefined);

    clearAfterReinstall(revoke);

    expect(revoke).not.toHaveBeenCalled();
    expect(installMarker().exists).toBe(true);
  });

  it('logs a failed revoke', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    storeEverything();
    mockDevice().files.clear();

    clearAfterReinstall(async () => {
      throw new Error('offline');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toHaveBeenCalledWith(
      'Could not revoke the previous install session:',
      expect.any(Error),
    );
    error.mockRestore();
  });

  it('leaves everything alone on later launches', () => {
    storeEverything();
    jest.clearAllMocks();
    const revoke = jest.fn(async () => undefined);

    clearAfterReinstall(revoke);

    expect(revoke).not.toHaveBeenCalled();
    expect(mocked.setItem).not.toHaveBeenCalled();
    expect(new SecureStoreStorage().get()?.refreshToken).toBe('old-token');
  });
});
