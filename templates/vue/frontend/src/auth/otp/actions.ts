import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';

export type OtpActionResult = { error?: string; success?: boolean };

export async function sendCode(
  nhost: NhostClient,
  email: string,
): Promise<OtpActionResult> {
  if (!email) {
    return { error: 'Enter your email address.' };
  }

  try {
    await nhost.auth.signInOTPEmail({ email });

    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the code: ${error.message}` };
  }
}

// A successful verify is the sign-in: the client stores the session as the
// response comes back, so the caller only has to navigate.
export async function verifyCode(
  nhost: NhostClient,
  email: string,
  otp: string,
): Promise<OtpActionResult> {
  if (!email || !otp) {
    return { error: 'Enter your email address and the code.' };
  }

  try {
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
