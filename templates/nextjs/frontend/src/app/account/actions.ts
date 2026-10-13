'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient, getVerifiedUser } from '@/lib/nhost/server';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
export type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

const SIGNED_OUT = 'You are signed out. Sign in and try again.';

// Where the links in the emails below land. Fixed rather than taken from the
// caller, so nothing here can aim a link at another host.
const ACCOUNT_URL = () => `${appOrigin()}/account`;

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
      return { error: SIGNED_OUT };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${errorMessage(err)}` };
  }
}

// Sends a confirmation link to the new address. The change happens when that
// link is opened, not here: until then the old address is the account's.
export async function changeEmail(newEmail: string): Promise<ActionResult> {
  if (!newEmail) {
    return { error: 'A new email address is required.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.changeUserEmail({
      newEmail,
      options: { redirectTo: ACCOUNT_URL() },
    });

    return { success: true };
  } catch (err) {
    return { error: `Could not start the email change: ${errorMessage(err)}` };
  }
}

// For an address that was never verified: sign-up sent one link, this sends
// another. The address comes from the auth service's own answer about who is
// signed in, not from the caller, so this cannot be pointed at someone else.
export async function resendVerification(): Promise<ActionResult> {
  try {
    const user = await getVerifiedUser();

    if (!user?.email) {
      return { error: SIGNED_OUT };
    }

    const nhost = await createNhostClient();
    await nhost.auth.sendVerificationEmail({
      email: user.email,
      options: { redirectTo: ACCOUNT_URL() },
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the verification email: ${errorMessage(err)}`,
    };
  }
}
