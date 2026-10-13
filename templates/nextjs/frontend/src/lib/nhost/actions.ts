'use server';

import { createNhostClient } from '@/lib/nhost/server';

export type ActionResult = { error?: string };

// Returns { error } instead of throwing, so a caller that cannot reach the auth
// service can show that instead of leaving the session cookie live with only a
// console line as evidence.
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

  // No redirect here: a Server Action's `redirect()` rejects the client-side
  // promise instead of resolving it (Next.js turns it into a thrown
  // `NEXT_REDIRECT`), which would send every successful sign-out into the
  // caller's `catch` block. Navigation is the caller's job.
  return {};
}
