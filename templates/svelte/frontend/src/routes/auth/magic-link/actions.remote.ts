import * as v from 'valibot';
import { appOrigin } from '#lib/nhost/env.server.ts';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
} from '#lib/nhost/errors.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { signInDestination } from '#routes/signin/destination.ts';
import { command } from '$app/server';

/** Emails a sign-in link. */
export const sendMagicLink = command(
  v.object({ email: v.string(), next: v.string() }),
  async ({ email, next }): Promise<ActionResult> => {
    if (!email) {
      return { error: 'Email is required.' };
    }

    const destination = signInDestination(next);

    try {
      const nhost = createNhostClient();
      await nhost.auth.signInPasswordlessEmail({
        email,
        options: { redirectTo: `${appOrigin()}${destination}` },
      });
      return { success: true };
    } catch (err) {
      return {
        error: `Could not send the link: ${errorMessage(err, RETRY_IN.email)}`,
      };
    }
  },
);
