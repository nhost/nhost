import type { SignInProvider } from '@nhost/nhost-js/auth';
import { openAuthSessionAsync } from 'expo-web-browser';
import { nhost } from '@/lib/nhost/client';
import { appUrl } from '@/lib/nhost/env';
import type { ActionResult } from '@/lib/nhost/errors';
import { openLink, startFlow } from '@/lib/nhost/links';
import { signInDestination } from '@/screens/signin/destination';
import { recordSignInAttempt } from '@/screens/signin/lastUsed';
import { ACCOUNT_PICKER, providerHref } from './providers';

/**
 * The in-app browser closes on the first redirect that starts with this, and
 * hands it back as its result. Every `redirectTo` is built on it.
 */
export const RETURN_URL = appUrl();

export const BROWSER_ERROR = 'Could not open the sign-in page. Try again.';

/**
 * Signs in with `id` in the in-app browser. Auth sends it back to `redirectTo`
 * with a code, which is traded like any other link's. Closing the browser
 * does nothing.
 */
export async function signInWithProvider(
  id: SignInProvider,
  next: string,
): Promise<ActionResult> {
  try {
    const { codeChallenge, redirectTo } = await startFlow(
      'signIn',
      signInDestination(next),
    );
    recordSignInAttempt(providerHref(id));

    const result = await openAuthSessionAsync(
      nhost.auth.signInProviderURL(id, {
        redirectTo,
        codeChallenge,
        upstreamParams: ACCOUNT_PICKER,
      }),
      RETURN_URL,
    );
    if (result.type !== 'success') {
      return {};
    }

    await openLink(result.url);
    return { success: true };
  } catch (err) {
    console.error('Could not sign in with the provider:', err);
    return { error: BROWSER_ERROR };
  }
}
