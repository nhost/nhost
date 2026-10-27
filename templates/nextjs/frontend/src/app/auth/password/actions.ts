'use server';

import { signInDestination } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';
import { type ActionResult, errorMessage } from '@/lib/nhost/errors';
import { createNhostClient, endPasswordReset } from '@/lib/nhost/server';

// The server client's storage writes the session cookie, so a sign-in that
// succeeds here is the sign-in.
export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult & { mfaTicket?: string }> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.auth.signInEmailPassword({ email, password });

    if (body.mfa?.ticket) {
      return { mfaTicket: body.mfa.ticket };
    }

    if (!body.session) {
      // Guards a 2xx that carries neither a session nor an MFA ticket.
      return { error: 'The server did not return a session. Try again.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not sign in: ${errorMessage(err)}` };
  }
}

export async function verifyMfa(
  ticket: string,
  otp: string,
): Promise<ActionResult> {
  if (!ticket || !otp) {
    return { error: 'Enter the code from your authenticator app.' };
  }

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.auth.verifySignInMfaTotp({ ticket, otp });

    if (!body.session) {
      return { error: 'That code did not work. Try again.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not verify the code: ${errorMessage(err)}` };
  }
}

// Returns `signedIn: true` only when the backend has email verification off.
export async function signUp(
  email: string,
  password: string,
  next: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const destination = signInDestination(next);

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: { redirectTo: `${appOrigin()}${destination}` },
    });

    return { success: true, signedIn: Boolean(body.session) };
  } catch (err) {
    return { error: `Could not sign up: ${errorMessage(err)}` };
  }
}

// The reset link signs the user in (the proxy redeems it) and lands them on the
// reset page, which is why that page can set a password without asking for the
// current one.
export async function requestPasswordReset(
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const nhost = await createNhostClient();
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: `${appOrigin()}/auth/password/reset` },
    });

    return { success: true };
  } catch (err) {
    return { error: `Could not send the reset link: ${errorMessage(err)}` };
  }
}

export async function setNewPassword(
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: 'The reset link has expired. Request another.' };
    }

    await nhost.auth.changeUserPassword({ newPassword });
    await endPasswordReset();

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${errorMessage(err)}` };
  }
}
