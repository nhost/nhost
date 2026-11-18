import type { FetchError } from '@nhost/nhost-js/fetch';
import type { ActionResult } from '@/lib/nhost/errors';
import { nhost } from './client';

// The SDK clears the stored session on any answer from `/signout`, error
// statuses included, and only then throws a `FetchError` for a status of 300 or
// more.
export async function signOut(): Promise<
  ActionResult & { stillSignedIn?: boolean }
> {
  try {
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

  return {};
}
