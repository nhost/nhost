import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { appOrigin } from '@/lib/nhost/env';
import { signInDestination } from '@/signin/destination';

type ActionResult = { error?: string; success?: boolean };

/**
 * Emails a sign-in link. Opening it brings the browser back here with a
 * refresh token on the URL, which `lib/nhost/linkToken.ts` redeems, so there
 * is nothing for this method to do after the email is out.
 *
 * `next` is validated here as well as on the page: the link in the email is
 * built from it, so a visitor who followed a crafted link into this app with
 * a `next` pointing elsewhere would be emailed a link that leaves.
 */
export async function sendMagicLink(
  nhost: NhostClient,
  email: string,
  next: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  const destination = signInDestination(next);

  try {
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
