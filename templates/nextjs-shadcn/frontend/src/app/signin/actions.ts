'use server';

import type { ErrorResponse, Session } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { appOrigin } from '@/lib/nhost/env';
import { clearPasswordResetGrant, createNhostClient } from '@/lib/nhost/server';

type ActionResult = { error?: string; success?: boolean; deleted?: boolean };

// Deleted accounts still sign in on purpose: it is how their owner reaches
// the restore screen during the grace period.
function markedDeleted(session: Session | null | undefined): boolean {
  const metadata = session?.user?.metadata as
    | { deletedAt?: string }
    | null
    | undefined;
  return Boolean(metadata?.deletedAt);
}

/**
 * Decides which second step the sign-in form shows for an address.
 *
 * Addresses with no password, and addresses with no account at all, both
 * answer `false` and go down the emailed-code path, which is also how signing
 * up works. See `backend/functions/auth-method.ts` for what that does and does
 * not reveal.
 *
 * This is a public, unauthenticated Server Action fronting that admin-secret
 * function from the sign-in page. Put a rate limit in front of `/auth-method`
 * (for example at the CDN/edge, keyed on client IP) before deploying this
 * publicly — see "Before you deploy" in `README.md`.
 */
export async function hasPassword(email: string): Promise<boolean> {
  if (!email) {
    return false;
  }

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.functions.post<{ hasPassword?: boolean }>(
      '/auth-method',
      { email },
    );

    return typeof body === 'object' && body?.hasPassword === true;
  } catch (err) {
    // Fall back to the code path, which works for every account.
    console.error('Could not look up the sign-in method:', err);
    return false;
  }
}

export async function sendOTP(email: string): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const nhost = await createNhostClient();
    await nhost.auth.signInOTPEmail({ email });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the code: ${error.message}` };
  }
}

export async function verifyOTP(
  email: string,
  otp: string,
): Promise<ActionResult> {
  if (!email || !otp) {
    return { error: 'Email and code are required.' };
  }

  try {
    const nhost = await createNhostClient();
    const response = await nhost.auth.verifySignInOTPEmail({ email, otp });

    if (response.body?.session) {
      // Whoever signed in now did not follow the reset link that granted the
      // exemption, even when it is the same person: a new sign-in starts with
      // no claim to skip re-authentication.
      await clearPasswordResetGrant();

      return { success: true, deleted: markedDeleted(response.body.session) };
    }

    return { error: 'Invalid or expired code. Please try again.' };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not verify the code: ${error.message}` };
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<ActionResult> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
    const nhost = await createNhostClient();
    const response = await nhost.auth.signInEmailPassword({ email, password });

    if (response.body?.session) {
      await clearPasswordResetGrant();

      return { success: true, deleted: markedDeleted(response.body.session) };
    }

    return { error: 'Could not sign in with that email and password.' };
  } catch {
    return { error: 'Wrong email or password.' };
  }
}

export async function sendPasswordReset(email: string): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const nhost = await createNhostClient();
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: `${appOrigin()}/reset-password` },
    });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the reset link: ${error.message}` };
  }
}
