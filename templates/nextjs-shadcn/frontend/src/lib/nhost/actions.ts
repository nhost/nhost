'use server';

import { redirect } from 'next/navigation';
import { createNhostClient } from '@/lib/nhost/server';

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

  redirect('/');
}
