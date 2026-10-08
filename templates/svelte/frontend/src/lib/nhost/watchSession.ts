import type { NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';

/**
 * Calls `listener` whenever the stored session changes, in this tab or in
 * another one, and returns the function that stops it.
 *
 * `sessionStorage.onChange` is the SDK's own subscriber list: it hears writes
 * made through this client, in this tab, and nothing else. Another tab signing
 * in, signing out or refreshing writes the same `localStorage` key, and the
 * browser reports that only as a `storage` event in every other tab, which the
 * SDK does not listen for. So both are needed.
 */
export function watchSession(
  nhost: NhostClient,
  listener: (session: Session | null) => void,
): () => void {
  const unsubscribe = nhost.sessionStorage.onChange(listener);

  // `key` is null when another tab clears the whole of `localStorage`.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === DEFAULT_SESSION_KEY || event.key === null) {
      listener(nhost.getUserSession());
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
  };
}
