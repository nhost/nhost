import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { checkSession, nhost } from './client';
import { endPasswordReset, PASSWORD_RESET_KEY } from './passwordReset';

/** How long a tab has to be away before coming back to it checks again. */
export const FOCUS_REFRESH_MS = 5 * 60 * 1000;

export type SessionCallbacks = {
  // The session as it is now, from this tab or another.
  onSession: (session: StoredSession | null) => void;
  // Run the guard again: another tab changed the session or the reset marker,
  // or the session turned out to be revoked.
  onRecheck: VoidFunction;
  // Load the page's data again.
  onRefresh: VoidFunction;
};

export type SessionWatcher = {
  /** Asks whether the session was revoked elsewhere, one check at a time. */
  checkRevoked: () => Promise<void>;
  stop: VoidFunction;
};

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Follows the session in this tab and others for as long as it runs. */
export function watchSession(callbacks: SessionCallbacks): SessionWatcher {
  let inFlight: Promise<void> | null = null;

  const checkRevoked = (): Promise<void> => {
    const session = nhost.getUserSession();
    if (!session) {
      return Promise.resolve();
    }

    inFlight ??= (async () => {
      try {
        if (
          (await checkSession(session)) === 'revoked' &&
          nhost.getUserSession()?.refreshTokenId === session.refreshTokenId
        ) {
          nhost.sessionStorage.remove();
          callbacks.onRecheck();
        }
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  // The marker means nothing without the session it was set for, and the
  // SDK's storage only removes its own key.
  const unsubscribe = nhost.sessionStorage.onChange((session) => {
    if (!session) {
      endPasswordReset();
    }
    callbacks.onSession(session);
  });

  // Fires for writes from other tabs only. A null key is `localStorage.clear()`.
  const onStorage = (event: StorageEvent): void => {
    if (event.storageArea && event.storageArea !== window.localStorage) {
      return;
    }
    if (event.key === PASSWORD_RESET_KEY) {
      callbacks.onRecheck();
      return;
    }
    if (event.key !== null && event.key !== DEFAULT_SESSION_KEY) {
      return;
    }

    const before = parseSession(event.oldValue);
    const session = nhost.getUserSession();
    if (!session) {
      endPasswordReset();
    }
    callbacks.onSession(session);
    callbacks.onRecheck();

    if (
      session &&
      (session.user?.id !== before?.user?.id ||
        session.refreshTokenId !== before?.refreshTokenId)
    ) {
      callbacks.onRefresh();
    }
  };

  // A tab left open never navigates, so coming back to it is what notices a
  // session revoked from another device.
  let last = Date.now();
  const onReturn = (): void => {
    if (
      document.visibilityState !== 'visible' ||
      Date.now() - last < FOCUS_REFRESH_MS ||
      !nhost.getUserSession()
    ) {
      return;
    }
    last = Date.now();
    void checkRevoked().then(callbacks.onRefresh);
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onReturn);
  document.addEventListener('visibilitychange', onReturn);

  return {
    checkRevoked,
    stop: () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    },
  };
}
