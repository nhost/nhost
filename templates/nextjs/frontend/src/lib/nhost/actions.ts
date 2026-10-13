'use server';

import type { FetchError } from '@nhost/nhost-js/fetch';
import { createNhostClient } from '@/lib/nhost/server';

export type ActionResult = { error?: string };

// The SDK deletes both session cookies on any answer from `/signout`, error
// statuses included, and only then throws a `FetchError` for a status of 300 or
// more. So an error with a status means this device is signed out whatever the
// auth service did, and only an error without one, where no answer came back,
// leaves the session cookie in place.
//
// `all` revokes every refresh token the account holds, not only this
// session's, which signs it out on every device. The auth service needs this
// session's access token for that, so without a session nothing is revoked.
export async function signOut({
  all = false,
}: {
  all?: boolean;
} = {}): Promise<ActionResult> {
  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return all
        ? {
            error:
              'You are not signed in here, so your other sessions could not be revoked. Sign in and try again.',
          }
        : {};
    }

    await nhost.auth.signOut({
      refreshToken: session.refreshToken,
      all,
    });
  } catch (err) {
    console.error('Error signing out:', err);

    if ((err as FetchError).status === undefined) {
      return { error: 'Could not reach the server. You are still signed in.' };
    }

    return {
      error: all
        ? 'You are signed out on this device, but your other sessions were not revoked. Sign in and try again.'
        : 'You are signed out on this device, but the sign-out request failed.',
    };
  }

  // No redirect here: a Server Action's `redirect()` rejects the client-side
  // promise instead of resolving it (Next.js turns it into a thrown
  // `NEXT_REDIRECT`), which would send every successful sign-out into the
  // caller's `catch` block. Navigation is the caller's job.
  return {};
}
