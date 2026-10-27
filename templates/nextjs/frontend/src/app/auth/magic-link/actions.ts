'use server';

import { signInDestination } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';
import { type ActionResult, errorMessage } from '@/lib/nhost/errors';
import { createNhostClient } from '@/lib/nhost/server';

/** Emails a sign-in link. */
export async function sendMagicLink(
  email: string,
  next: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  const destination = signInDestination(next);

  try {
    const nhost = await createNhostClient();
    await nhost.auth.signInPasswordlessEmail({
      email,
      options: { redirectTo: `${appOrigin()}${destination}` },
    });
    return { success: true };
  } catch (err) {
    return { error: `Could not send the link: ${errorMessage(err)}` };
  }
}
