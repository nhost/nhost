'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { signInDestination } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';

type ActionResult = { error?: string; success?: boolean };

/**
 * Emails a sign-in link. Opening it signs the visitor in and lands them on
 * `next`; the proxy redeems the token the link carries, so there is nothing
 * for this method to do after the email is out.
 *
 * `next` is checked again here even though the page already did: a server
 * action is a public endpoint anyone can call with any arguments, and `next`
 * is appended to the origin, so a value that is not a path could change the
 * host the link sends its token to.
 *
 * No redirect here: the action resolves with a result and the form decides
 * what to show. See `@/lib/nhost/actions` for why.
 */
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
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the link: ${error.message}` };
  }
}
