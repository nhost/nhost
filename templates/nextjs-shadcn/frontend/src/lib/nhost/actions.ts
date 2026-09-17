'use server';

import { redirect } from 'next/navigation';
import { clearPasswordResetGrant, createNhostClient } from '@/lib/nhost/server';

export async function signOut(): Promise<void> {
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
    throw err;
  }

  // The grant outlives the session it was issued under unless it is taken
  // away here: it is a 15 minute exemption from re-authentication, and on a
  // shared machine the next person to sign in would inherit it.
  await clearPasswordResetGrant();

  redirect('/');
}
