import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS, SECURE_STORE_OPTIONS } from '@/lib/deviceStore';
import { SecureStoreStorage } from '@/lib/nhost/storage';

/** A file that exists from the first launch of an install until uninstall. */
export function installMarker(): File {
  return new File(Paths.document, 'nhost-installed');
}

/**
 * Clears what a previous install left in SecureStore. The iOS keychain outlives
 * an uninstall, while the app's files do not, so a missing marker file means
 * this is the first launch. Everything but the revoke is synchronous, so it is
 * done before the caller reads a key.
 */
export function clearAfterReinstall(
  revoke: (refreshToken: string) => Promise<unknown>,
): void {
  const marker = installMarker();
  if (marker.exists) {
    return;
  }

  try {
    const refreshToken = new SecureStoreStorage().get()?.refreshToken;
    for (const key of SECURE_STORE_KEYS) {
      SecureStore.setItem(key, '', SECURE_STORE_OPTIONS);
    }
    if (refreshToken) {
      revoke(refreshToken).catch((err: unknown) => {
        console.error('Could not revoke the previous install session:', err);
      });
    }
    marker.create();
  } catch (err) {
    console.error('Could not clear the previous install:', err);
  }
}
