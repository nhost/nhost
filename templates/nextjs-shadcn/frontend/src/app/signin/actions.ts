'use server';

import type { ErrorResponse, Session } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { headers } from 'next/headers';
import { createNhostClient } from '@/lib/nhost/server';

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
      return { success: true, deleted: markedDeleted(response.body.session) };
    }

    return { error: 'Could not sign in with that email and password.' };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not sign in: ${error.message}` };
  }
}

export async function sendPasswordReset(email: string): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';

  try {
    const nhost = await createNhostClient();
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: `${proto}://${host}/reset-password` },
    });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the reset link: ${error.message}` };
  }
}
