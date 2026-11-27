import {
  couldBeAPassword,
  newPasswordError,
  newPasswordProblem,
} from '@/app/auth/password/requirements';
import { signInDestination } from '@/app/signin/destination';
import { nhost } from '@/lib/nhost/client';
import { appOrigin } from '@/lib/nhost/env';
import { type ActionResult, errorMessage, RETRY_IN } from '@/lib/nhost/errors';
import { endPasswordReset } from '@/lib/nhost/passwordReset';

// The client stores the session any sign-in answers with, so a sign-in that
// succeeds here is the sign-in.
export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult & { mfaTicket?: string }> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  // Auth would refuse it as a malformed request rather than a wrong password.
  if (!couldBeAPassword(password)) {
    return { error: 'Could not sign in: Incorrect email or password' };
  }

  try {
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
    return {
      error: `Could not sign in: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
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
    const { body } = await nhost.auth.verifySignInMfaTotp({ ticket, otp });

    if (!body.session) {
      return { error: 'That code did not work. Try again.' };
    }

    return { success: true };
  } catch (err) {
    return {
      error: `Could not verify the code: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
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

  const problem = newPasswordProblem(password);
  if (problem) {
    return { error: problem };
  }

  const destination = signInDestination(next);

  try {
    const { body } = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: { redirectTo: `${appOrigin()}${destination}` },
    });

    return { success: true, signedIn: Boolean(body.session) };
  } catch (err) {
    return {
      error: `Could not sign up: ${newPasswordError(err, RETRY_IN.email)}`,
    };
  }
}

// The reset link signs the user in (startup redeems it) and lands them on the
// reset page, which is why that page can set a password without asking for the
// current one.
export async function requestPasswordReset(
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: `${appOrigin()}/auth/password/reset` },
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the reset link: ${errorMessage(err, RETRY_IN.email)}`,
    };
  }
}

// The client clears the stored session once the change succeeds: auth has
// just revoked it, with every other session of the account.
export async function setNewPassword(
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  const problem = newPasswordProblem(newPassword);
  if (problem) {
    return { error: problem };
  }

  try {
    if (!nhost.getUserSession()) {
      return { error: 'The reset link has expired. Request another.' };
    }

    await nhost.auth.changeUserPassword({ newPassword });
    endPasswordReset();

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${newPasswordError(err)}` };
  }
}
