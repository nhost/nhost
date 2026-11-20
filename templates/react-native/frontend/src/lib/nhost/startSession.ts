import { bounded, TIMED_OUT } from '@/lib/utils';
import { checkSession, nhost } from './client';
import { endPasswordReset } from './passwordReset';

// How close to expiry startup refreshes the access token, so the first screen
// does not have to.
const START_REFRESH_MARGIN_SECONDS = 60;

/**
 * How long startup waits on the network. The splash stays up until startup
 * settles, so a network that never answers must not hold it there.
 */
export const START_TIMEOUT_MS = 10_000;

let started: Promise<void> | undefined;

/**
 * Settles the session before the first render: refreshes it and drops it if
 * it was revoked elsewhere. Runs once per launch, however often it is called,
 * and never rejects.
 */
export function startSession(): Promise<void> {
  started ??= run();
  return started;
}

async function settle(): Promise<void> {
  // Signs out on a 401 and keeps the session on any other failure.
  await nhost.refreshSession(START_REFRESH_MARGIN_SECONDS);

  // A session revoked from elsewhere, by a password change or from another
  // device's account screen, still holds an access token the backend accepts
  // until it expires.
  const session = nhost.getUserSession();
  if (session && (await checkSession(session)) === 'revoked') {
    // Unless something signed in again meanwhile.
    if (nhost.getUserSession()?.refreshTokenId === session.refreshTokenId) {
      nhost.sessionStorage.remove();
    }
  }
}

async function run(): Promise<void> {
  try {
    // Running out of time is a failure to answer, which keeps the session. The
    // steps carry on, and whatever they change later reaches the app through
    // the session's change listeners.
    if ((await bounded(settle(), START_TIMEOUT_MS)) === TIMED_OUT) {
      console.error('Could not start the session in time, keeping it');
    }

    // The marker means nothing without the session it was set for.
    if (!nhost.getUserSession()) {
      endPasswordReset();
    }
  } catch (err) {
    console.error('Could not start the session:', err);
  }
}
