'use server';

import type { FetchError } from '@nhost/nhost-js/fetch';
import { redirect } from 'next/navigation';
import { createNhostClient } from '@/lib/nhost/server';

export type ActionResult = { error?: string };

// The SDK deletes both session cookies on any answer from `/signout`, error
// statuses included, and only then throws a `FetchError` for a status of 300 or
// more. So an error with a status means this device is signed out whatever the
// auth service did, and only an error without one, where no answer came back,
// leaves the session cookie in place, and only that one says
// `stillSignedIn`.
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

  // No redirect here: awaited directly, a Server Action's `redirect()`
  // rejects the client-side promise instead of resolving it (Next.js turns it
  // into a thrown `NEXT_REDIRECT`), which would send every successful sign-out
  // into the caller's `catch` block. `signOutAndGoHome` is the one that
  // redirects, for the controls that only ever go home.
  return {};
}

/**
 * Signs out and answers with the home page, in one round trip: called through
 * `useActionState`, Next renders the page `redirect()` names and sends it back
 * with the action's answer, where navigating afterwards would be another
 * request, and another render of the old page in between.
 *
 * Only a server that did not answer leaves this browser signed in, and that
 * is the one answer that stays put to say so. Every other one has deleted the
 * session cookies, so it goes home.
 */
export async function signOutAndGoHome(): Promise<ActionResult> {
  const result = await signOut();

  if (result.stillSignedIn) {
    return { error: result.error };
  }

  redirect('/');
}
