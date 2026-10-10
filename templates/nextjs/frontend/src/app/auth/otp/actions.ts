'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { createNhostClient } from '@/lib/nhost/server';

export type OtpActionResult = { error?: string; success?: boolean };

export async function sendCode(email: string): Promise<OtpActionResult> {
  if (!email) {
    return { error: 'Enter your email address.' };
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

// A successful verify is the sign-in: the client's storage writes the session
// cookie, so the caller only has to navigate. No redirect here, see
// `@/lib/nhost/actions` for why.
export async function verifyCode(
  email: string,
  otp: string,
): Promise<OtpActionResult> {
  if (!email || !otp) {
    return { error: 'Enter your email address and the code.' };
  }

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.auth.verifySignInOTPEmail({ email, otp });

    if (!body?.session) {
      return { error: 'That code did not work. Try again.' };
    }

    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not verify the code: ${error.message}` };
  }
}
