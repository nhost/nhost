'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import {
  clearRecoveryToken,
  createMemoryClient,
  createNhostClient,
  readRecoveryToken,
  writeRecoveryToken,
} from '@/lib/nhost/server';

type ActionResult = { error?: string; success?: boolean };

const EXPIRED =
  'This reset link is no longer valid. Ask for a new one and open it in this browser.';

/**
 * Sets a new password for the account a reset link named.
 *
 * Deliberately not `changePassword` from the profile page. That one works on
 * the session in the browser and asks for the current password, which is the
 * one thing somebody resetting does not have. This one works on the refresh
 * token the proxy put aside when it redeemed the link, so the password lands
 * on the account the link was issued for even if this browser was signed into
 * a different one, and the pre-existing session is never touched.
 *
 * The cookie holding that token is httpOnly and was only written after a code
 * was exchanged against a verifier this app generated, so reaching this action
 * means following a real link in the browser that asked for it.
 */
export async function resetPassword(
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A password is required.' };
  }

  const recoveryToken = await readRecoveryToken();
  if (!recoveryToken) {
    return { error: EXPIRED };
  }

  const recovery = createMemoryClient();
  let email: string | undefined;

  try {
    const { body } = await recovery.auth.refreshToken({
      refreshToken: recoveryToken,
    });
    recovery.sessionStorage.set(body);
    // The refresh just rotated the token, so the value still in the cookie is
    // dead. Re-park the rotated one now, before the change that can fail, so a
    // rejected password lands on a live cookie and stays retryable.
    await writeRecoveryToken(body.refreshToken);
    email = recovery.sessionStorage.get()?.user?.email;
  } catch {
    await clearRecoveryToken();
    return { error: EXPIRED };
  }

  if (!email) {
    await clearRecoveryToken();
    return { error: EXPIRED };
  }

  try {
    await recovery.auth.changeUserPassword({ newPassword });
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not change the password: ${error.message}` };
  }

  // Spent, whatever happens next: the change revoked every refresh token for
  // the account, including this one.
  await clearRecoveryToken();

  // Only now does a session appear in this browser, and it is one this
  // password just earned rather than one the link handed over.
  try {
    const nhost = await createNhostClient();
    await nhost.auth.signInEmailPassword({ email, password: newPassword });
  } catch {
    return {
      error:
        'Your password was changed, but this device was not signed in. Sign in with the new password.',
    };
  }

  return { success: true };
}
