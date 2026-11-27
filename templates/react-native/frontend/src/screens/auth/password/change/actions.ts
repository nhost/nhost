import type { Session } from '@nhost/nhost-js/auth';
import { FetchError } from '@nhost/nhost-js/fetch';
import { bareAuth, nhost } from '@/lib/nhost/client';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
  SIGNED_OUT,
} from '@/lib/nhost/errors';
import {
  newPasswordError,
  newPasswordProblem,
} from '@/screens/auth/password/requirements';

type ChangeResult = ActionResult & { signedIn?: boolean };

export const WRONG_CODE =
  'That code did not work, so the password was not changed. Try again.';

// The SDK's own lock, from nhost-js `src/session/refreshSession.ts`, on the
// in-process manager `lib/polyfills.ts` installs. Holding it from the change to
// the sign-back-in keeps the app's other requests from refreshing with the
// token the change revokes, which would sign this device out. The lock does not
// re-enter and the main client takes it on every request, so nothing under it
// may call the main client.
const SESSION_LOCK = 'nhostSessionLock';

// So the access token outlasts the requests that use it.
const REFRESH_MARGIN_SECONDS = 60;

async function withSessionLock<T>(callback: () => Promise<T>): Promise<T> {
  return await navigator.locks.request(
    SESSION_LOCK,
    { mode: 'exclusive' },
    callback,
  );
}

// The auth service takes the new password and nothing else: no current
// password, and no check that one was ever set, so this works for an account
// created by magic link as much as one created with a password.
export async function changePassword(
  newPassword: string,
  otp?: string,
): Promise<ChangeResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  const problem = newPasswordProblem(newPassword);
  if (problem) {
    return { error: problem };
  }

  try {
    // Before the lock, which the refresh takes too.
    await nhost.refreshSession(REFRESH_MARGIN_SECONDS);
    return await withSessionLock(() => changeAndSignBackIn(newPassword, otp));
  } catch (err) {
    return { error: `Could not change the password: ${newPasswordError(err)}` };
  }
}

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

// On the bare client: the main client would clear the stored session as soon
// as the change succeeds, before there is a new one to put in its place.
async function changeAndSignBackIn(
  newPassword: string,
  otp: string | undefined,
): Promise<ChangeResult> {
  const session = nhost.getUserSession();

  if (!session) {
    return { error: SIGNED_OUT };
  }

  const auth = bareAuth();

  // The change itself takes no code, so with two-factor on the code is checked
  // first: a wrong one must not change the password and sign this device out.
  let checked: Session | null = null;
  if (otp) {
    try {
      checked = await checkCode(auth.baseURL, session.accessToken, otp);
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
    await auth.changeUserPassword(
      { newPassword },
      {
        headers: {
          Authorization: `Bearer ${(checked ?? session).accessToken}`,
        },
      },
    );
  } catch (err) {
    // A successful change revokes every session, the checked one included.
    if (checked) {
      await auth
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
    const { body } = await auth.signInEmailPassword({
      email,
      password: newPassword,
    });
    let signedIn: Session | null | undefined = body.session;

    // Two-factor answers the password with a ticket, which the code trades
    // for the session.
    if (!signedIn && body.mfa?.ticket && otp) {
      const verified = await auth.verifySignInMfaTotp({
        ticket: body.mfa.ticket,
        otp,
      });
      signedIn = verified.body.session;
    }

    if (!signedIn) {
      return { success: true, signedIn: false };
    }

    nhost.sessionStorage.set(signedIn);
    return { success: true, signedIn: true };
  } catch (err) {
    console.error('Could not sign back in after the password change:', err);
    return { success: true, signedIn: false };
  }
}
