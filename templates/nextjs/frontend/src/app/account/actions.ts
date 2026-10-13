'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { createNhostClient } from '@/lib/nhost/server';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
export type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

// The auth service takes the new password and nothing else: no current
// password, and no check that one was ever set, so this works for an account
// created by magic link as much as one created with a password. A signed-in
// session is what authorises the change, which is why the form says so
// rather than asking for something it would not use.
export async function changePassword(
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: 'You are signed out. Sign in and try again.' };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${errorMessage(err)}` };
  }
}
