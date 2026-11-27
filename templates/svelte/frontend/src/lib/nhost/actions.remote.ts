import type { FetchError } from '@nhost/nhost-js/fetch';
import { command } from '$app/server';
import type { ActionResult } from './errors.ts';
import { createNhostClient } from './server.ts';

// The SDK deletes the session cookies on any answer from `/signout`, error
// statuses included, and only then throws a `FetchError` for a status of 300 or
// more.
export const signOut = command(
  async (): Promise<ActionResult & { stillSignedIn?: boolean }> => {
    try {
      const nhost = createNhostClient();
      const session = nhost.getUserSession();

      if (!session) {
        return {};
      }

      await nhost.auth.signOut({ refreshToken: session.refreshToken });
    } catch (err) {
      console.error('Error signing out:', err);

      if ((err as FetchError).status === undefined) {
        return {
          error: 'Could not reach the server. You are still signed in.',
          stillSignedIn: true,
        };
      }

      return {
        error:
          'You are signed out on this device, but the sign-out request failed.',
      };
    }

    // No redirect here: a command cannot send one. The caller goes home.
    return {};
  },
);
