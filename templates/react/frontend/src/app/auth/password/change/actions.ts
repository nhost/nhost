import type { Session } from '@nhost/nhost-js/auth';
import {
  newPasswordError,
  newPasswordProblem,
} from '@/app/auth/password/requirements';
import { bareAuth, nhost } from '@/lib/nhost/client';
import { type ActionResult, SIGNED_OUT } from '@/lib/nhost/errors';

type ChangeResult = ActionResult & { signedIn?: boolean };

// The SDK's own lock, from nhost-js `src/session/refreshSession.ts`. Holding it
// from the change to the sign-back-in keeps every tab from refreshing with the
// token the change revokes, which would sign them all out. Web Locks do not
// re-enter and the main client takes this lock on every request, so nothing
// under it may call the main client.
const SESSION_LOCK = 'nhostSessionLock';

// So the access token outlasts the requests that use it.
const REFRESH_MARGIN_SECONDS = 60;

async function withSessionLock<T>(callback: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return callback();
  }
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
  await auth.changeUserPassword(
    { newPassword },
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );

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
