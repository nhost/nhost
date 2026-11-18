import { codePageURL } from '@/app/auth/otp/link';
import { nhost } from '@/lib/nhost/client';
import { type ActionResult, errorMessage } from '@/lib/nhost/errors';

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
    return { error: `Could not send the code: ${errorMessage(err)}` };
  }
}

// A successful verify is the sign-in: the client stores the session it answers
// with, so the caller only has to navigate.
export async function verifyCode(
  email: string,
  otp: string,
): Promise<ActionResult> {
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
    return { error: `Could not verify the code: ${errorMessage(err)}` };
  }
}
