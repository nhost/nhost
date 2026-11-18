'use server';

import {
  newPasswordError,
  newPasswordProblem,
} from '@/app/auth/password/requirements';
import { type ActionResult, SIGNED_OUT } from '@/lib/nhost/errors';
import { createNhostClient } from '@/lib/nhost/server';

// The auth service takes the new password and nothing else: no current
// password, and no check that one was ever set, so this works for an account
// created by magic link as much as one created with a password.
export async function changePassword(
  newPassword: string,
  otp?: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  const problem = newPasswordProblem(newPassword);
  if (problem) {
    return { error: problem };
  }

  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    const email = session.user?.email;
    if (!email) {
      return { success: true, signedIn: false };
    }

    try {
      const { body } = await nhost.auth.signInEmailPassword({
        email,
        password: newPassword,
      });

      // Two-factor answers the password with a ticket, which the code trades
      // for the session.
      if (!body.session && body.mfa?.ticket && otp) {
        const verified = await nhost.auth.verifySignInMfaTotp({
          ticket: body.mfa.ticket,
          otp,
        });
        return { success: true, signedIn: Boolean(verified.body.session) };
      }

      return { success: true, signedIn: Boolean(body.session) };
    } catch (err) {
      console.error('Could not sign back in after the password change:', err);
      return { success: true, signedIn: false };
    }
  } catch (err) {
    return { error: `Could not change the password: ${newPasswordError(err)}` };
  }
}
