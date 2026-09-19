'use server';

import { clearPasswordResetGrant, createNhostClient } from '@/lib/nhost/server';

type ActionResult = { error?: string };

// Returns { error } like every other action in the template instead of
// throwing, so a caller that cannot reach the auth service can show that
// instead of leaving the session cookie live with only a console line as
// evidence.
export async function signOut(): Promise<ActionResult> {
  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (session) {
      await nhost.auth.signOut({
        refreshToken: session.refreshToken,
      });
    }
  } catch (err) {
    console.error('Error signing out:', err);
    return { error: 'Could not reach the server. You are still signed in.' };
  }

  // The grant outlives the session it was issued under unless it is taken
  // away here: it is a 15 minute exemption from re-authentication, and on a
  // shared machine the next person to sign in would inherit it.
  await clearPasswordResetGrant();

  // No redirect here: a Server Action's `redirect()` rejects the client-side
  // promise instead of resolving it (Next.js turns it into a thrown
  // `NEXT_REDIRECT`), which would send every successful sign-out into the
  // callers' `catch` blocks. Navigation is the callers' job, same as
  // `deleteAccount` leaves it to `DeleteAccountCard`.
  return {};
}
