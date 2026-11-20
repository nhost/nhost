import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { codePageURL } from '@/app/auth/otp/link';
import { nhost } from '@/lib/nhost/client';
import { type ActionResult, errorMessage, RETRY_IN } from '@/lib/nhost/errors';

export async function sendCode(
  email: string,
  next: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Enter your email address.' };
  }

  try {
    await nhost.auth.signInOTPEmail({
      email,
      options: { redirectTo: codePageURL(email, next) },
    });
    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the code: ${errorMessage(err, RETRY_IN.email)}`,
    };
  }
}

// Sending a code replaces the last one, so a code from an earlier email is
// wrong too. Auth burns the code after five wrong tries.
export const WRONG_CODE =
  'That code did not work. Use the code from the most recent email, or send a new one.';
export const NO_TRIES_LEFT =
  'Too many wrong codes, so that code no longer works. Send a new one.';

// A successful verify is the sign-in: the client stores the session it answers
// with, so the caller only has to navigate.
export async function verifyCode(
  email: string,
  otp: string,
): Promise<ActionResult> {
  // Pasted from the email, a code can bring spaces or a line break with it.
  const code = otp.replace(/\s/g, '');

  if (!email || !code) {
    return { error: 'Enter your email address and the code.' };
  }

  try {
    const { body } = await nhost.auth.verifySignInOTPEmail({
      email,
      otp: code,
    });

    if (!body?.session) {
      return { error: 'That code did not work. Try again.' };
    }

    return { success: true };
  } catch (err) {
    switch ((err as FetchError<ErrorResponse>).body?.error) {
      case 'invalid-otp':
        return { error: WRONG_CODE };
      case 'otp-too-many-attempts':
        return { error: NO_TRIES_LEFT };
    }
    return {
      error: `Could not verify the code: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}
