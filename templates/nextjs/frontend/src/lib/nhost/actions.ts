'use server';

import type { FetchError } from '@nhost/nhost-js/fetch';
import { createNhostClient } from '@/lib/nhost/server';

export type ActionResult = { error?: string };

// The SDK deletes both session cookies on any answer from `/signout`, error
// statuses included, and only then throws a `FetchError` for a status of 300 or
// more. So an error with a status means this device is signed out whatever the
// auth service did, and only an error without one, where no answer came back,
// leaves the session cookie in place, and only that one says
// `stillSignedIn`: every other answer, errors included, means this browser is
// signed out, which is what lets the page treat sign-out as done before it is.
export async function signOut(): Promise<
  ActionResult & { stillSignedIn?: boolean }
> {
  try {
    const nhost = await createNhostClient();
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

  // No redirect here: a Server Action's `redirect()` rejects the client-side
  // promise instead of resolving it (Next.js turns it into a thrown
  // `NEXT_REDIRECT`), which would send every successful sign-out into the
  // caller's `catch` block. Navigation is the caller's job.
  return {};
}
