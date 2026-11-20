import { nhost } from '@/lib/nhost/client';
import { type ActionResult, errorMessage, RETRY_IN } from '@/lib/nhost/errors';
import { startFlow } from '@/lib/nhost/links';
import { signInDestination } from '@/screens/signin/destination';

/** Emails a sign-in link. */
export async function sendMagicLink(
  email: string,
  next: string,
): Promise<ActionResult> {
  const address = email.trim();
  if (!address) {
    return { error: 'Email is required.' };
  }

  try {
    const { codeChallenge, redirectTo } = await startFlow(
      'signIn',
      signInDestination(next),
    );
    await nhost.auth.signInPasswordlessEmail({
      email: address,
      options: { redirectTo },
      codeChallenge,
    });
    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the link: ${errorMessage(err, RETRY_IN.email)}`,
    };
  }
}
