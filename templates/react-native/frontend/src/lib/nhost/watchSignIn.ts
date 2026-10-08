import type { Session } from '@nhost/nhost-js/auth';

/**
 * Follows the session the app shows and calls `onSignIn` when somebody signs
 * in: a session where there was none. Before the stored session is read,
 * memory is empty, so the one read off disk would look like a sign-in too.
 * `hydrated` takes it as the starting point instead, because it is who the
 * user already was.
 */
export function watchSignIn(onSignIn: () => void): {
  hydrated: (session: Session | null) => void;
  seen: (session: Session | null) => void;
} {
  let current: Session | null = null;

  return {
    hydrated: (session) => {
      current = session;
    },
    seen: (session) => {
      if (session && !current) {
        onSignIn();
      }
      current = session;
    },
  };
}
