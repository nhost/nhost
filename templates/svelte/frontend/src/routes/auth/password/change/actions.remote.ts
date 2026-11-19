import { createAPIClient, type Session } from '@nhost/nhost-js/auth';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as v from 'valibot';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
  SIGNED_OUT,
} from '#lib/nhost/errors.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { command, getRequestEvent } from '$app/server';
import { newPasswordError, newPasswordProblem } from '../requirements.ts';

const WRONG_CODE =
  'That code did not work, so the password was not changed. Try again.';

// Auth's `POST /elevate/totp` (auth 0.53.0), which the published SDK does not
// have yet. A right code gets a session of its own back; a wrong one changes
// nothing.
async function checkCode(
  baseURL: string,
  accessToken: string,
  otp: string,
): Promise<Session | null> {
  const response = await fetch(`${baseURL}/elevate/totp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // It counts against auth's brute-force limit, which is per visitor.
      'X-Forwarded-For': getRequestEvent().getClientAddress(),
    },
    body: JSON.stringify({ otp }),
  });
  const body = await response.json().catch(() => null);

  if (response.ok && body?.session) {
    return body.session as Session;
  }
  if (body?.error === 'invalid-totp') {
    return null;
  }
  throw new FetchError(body, response.status, response.headers);
}

// The auth service takes the new password and nothing else: no current
// password, and no check that one was ever set, so this works for an account
// created by magic link as much as one created with a password.
export const changePassword = command(
  v.object({ newPassword: v.string(), otp: v.optional(v.string()) }),
  async ({
    newPassword,
    otp,
  }): Promise<ActionResult & { signedIn?: boolean }> => {
    if (!newPassword) {
      return { error: 'A new password is required.' };
    }

    const problem = newPasswordProblem(newPassword);
    if (problem) {
      return { error: problem };
    }

    try {
      const nhost = createNhostClient();
      const session = nhost.getUserSession();

      if (!session) {
        return { error: SIGNED_OUT };
      }

      // The change itself takes no code, so with two-factor on the code is
      // checked first: a wrong one must not change the password and sign this
      // browser out.
      let checked: Session | null = null;
      if (otp) {
        try {
          checked = await checkCode(
            nhost.auth.baseURL,
            session.accessToken,
            otp,
          );
        } catch (err) {
          return {
            error: `Could not check the code: ${errorMessage(err, RETRY_IN.signIn)}`,
          };
        }
        if (!checked) {
          return { error: WRONG_CODE };
        }
      }

      try {
        await nhost.auth.changeUserPassword(
          { newPassword },
          checked
            ? { headers: { Authorization: `Bearer ${checked.accessToken}` } }
            : undefined,
        );
      } catch (err) {
        // A successful change revokes every session, the checked one included.
        // On a bare client: this one would clear the session cookie on
        // /signout.
        if (checked) {
          await createAPIClient(nhost.auth.baseURL)
            .signOut({ refreshToken: checked.refreshToken })
            .catch(() => undefined);
        }
        throw err;
      }

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
      return {
        error: `Could not change the password: ${newPasswordError(err)}`,
      };
    }
  },
);
