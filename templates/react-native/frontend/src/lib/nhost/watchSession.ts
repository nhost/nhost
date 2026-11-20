import type { StoredSession } from '@nhost/nhost-js/session';
import { AppState, type AppStateStatus } from 'react-native';
import { checkSession, nhost } from './client';
import { endPasswordReset } from './passwordReset';

/** How long the app has to be away before coming back to it checks again. */
export const FOCUS_REFRESH_MS = 5 * 60 * 1000;

export type SessionCallbacks = {
  // The session as it is now.
  onSession: (session: StoredSession | null) => void;
  // The session turned out to be revoked elsewhere, and is gone.
  onRevoked: VoidFunction;
  // Load the screen's data again.
  onRefresh: VoidFunction;
};

export type SessionWatcher = {
  /** Asks whether the session was revoked elsewhere, one check at a time. */
  checkRevoked: () => Promise<void>;
  stop: VoidFunction;
};

/** Follows the session for as long as it runs. */
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
          callbacks.onRevoked();
        }
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  // The marker means nothing without the session it was set for, and the
  // SDK's storage only clears its own keys.
  const unsubscribe = nhost.sessionStorage.onChange((session) => {
    if (!session) {
      endPasswordReset();
    }
    callbacks.onSession(session);
  });

  // An app left open on one screen never navigates, so coming back to it is
  // what notices a session revoked from another device.
  let last = Date.now();
  const onAppState = (state: AppStateStatus): void => {
    if (
      state !== 'active' ||
      Date.now() - last < FOCUS_REFRESH_MS ||
      !nhost.getUserSession()
    ) {
      return;
    }
    last = Date.now();
    void checkRevoked().then(callbacks.onRefresh);
  };
  const subscription = AppState.addEventListener('change', onAppState);

  return {
    checkRevoked,
    stop: () => {
      unsubscribe();
      subscription.remove();
    },
  };
}
