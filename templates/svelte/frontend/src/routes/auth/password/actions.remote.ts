import * as v from 'valibot';
import { appOrigin } from '#lib/nhost/env.server.ts';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
} from '#lib/nhost/errors.ts';
import { createNhostClient, endPasswordReset } from '#lib/nhost/server.ts';
import { signInDestination } from '#routes/signin/destination.ts';
import { command } from '$app/server';
import {
  couldBeAPassword,
  newPasswordError,
  newPasswordProblem,
} from './requirements.ts';

// The server client's storage writes the session cookie, so a sign-in that
// succeeds here is the sign-in.
export const signIn = command(
  v.object({ email: v.string(), password: v.string() }),
  async ({
    email,
    password,
  }): Promise<ActionResult & { mfaTicket?: string }> => {
    if (!email || !password) {
      return { error: 'Email and password are required.' };
    }

    // Auth would refuse it as a malformed request rather than a wrong password.
    if (!couldBeAPassword(password)) {
      return { error: 'Could not sign in: Incorrect email or password' };
    }

    try {
      const nhost = createNhostClient();
      const { body } = await nhost.auth.signInEmailPassword({
        email,
        password,
      });

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
  },
);

export const verifyMfa = command(
  v.object({ ticket: v.string(), otp: v.string() }),
  async ({ ticket, otp }): Promise<ActionResult> => {
    if (!ticket || !otp) {
      return { error: 'Enter the code from your authenticator app.' };
    }

    try {
      const nhost = createNhostClient();
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
  },
);

// Returns `signedIn: true` only when the backend has email verification off.
export const signUp = command(
  v.object({ email: v.string(), password: v.string(), next: v.string() }),
  async ({
    email,
    password,
    next,
  }): Promise<ActionResult & { signedIn?: boolean }> => {
    if (!email || !password) {
      return { error: 'Email and password are required.' };
    }

    const problem = newPasswordProblem(password);
    if (problem) {
      return { error: problem };
    }

    const destination = signInDestination(next);

    try {
      const nhost = createNhostClient();
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
  },
);

// The reset link signs the user in (the server hook redeems it) and lands them
// on the reset page, which is why that page can set a password without asking
// for the current one.
export const requestPasswordReset = command(
  v.string(),
  async (email): Promise<ActionResult> => {
    if (!email) {
      return { error: 'Email is required.' };
    }

    try {
      const nhost = createNhostClient();
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
  },
);

export const setNewPassword = command(
  v.string(),
  async (newPassword): Promise<ActionResult> => {
    if (!newPassword) {
      return { error: 'A new password is required.' };
    }

    const problem = newPasswordProblem(newPassword);
    if (problem) {
      return { error: problem };
    }

    try {
      const nhost = createNhostClient();

      if (!nhost.getUserSession()) {
        return { error: 'The reset link has expired. Request another.' };
      }

      await nhost.auth.changeUserPassword({ newPassword });
      endPasswordReset();

      return { success: true };
    } catch (err) {
      return {
        error: `Could not change the password: ${newPasswordError(err)}`,
      };
    }
  },
);
