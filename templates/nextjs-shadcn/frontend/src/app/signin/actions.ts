'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { createNhostClient } from '@/lib/nhost/server';

type ActionResult = { error?: string; success?: boolean };

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
      return { success: true };
    }

    return { error: 'Invalid or expired code. Please try again.' };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not verify the code: ${error.message}` };
  }
}
