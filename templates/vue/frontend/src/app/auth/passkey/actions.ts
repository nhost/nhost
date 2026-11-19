import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { signInDestination } from '@/app/signin/destination';
import { nhost } from '@/lib/nhost/client';
import { appOrigin } from '@/lib/nhost/env';
import { type ActionResult, errorMessage, RETRY_IN } from '@/lib/nhost/errors';

// A passkey ceremony is two round trips with the browser's step in between: the
// backend issues a challenge, the authenticator signs it, the backend checks
// the signature.

// `next` is checked again here even though the page already did: it is
// appended to the origin the verification email points at.
function redirectTo(next: string): string {
  return `${appOrigin()}${signInDestination(next)}`;
}

export async function beginSignUp(
  email: string,
  next: string,
): Promise<ActionResult & { options?: PublicKeyCredentialCreationOptions }> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const { body } = await nhost.auth.signUpWebauthn({
      email,
      options: { redirectTo: redirectTo(next) },
    });

    return { options: body };
  } catch (err) {
    return {
      error: `Could not start sign up: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}

// Returns `signedIn: true` only when the backend has email verification off.
export async function finishSignUp(
  credential: CredentialCreationResponse,
  next: string,
  nickname?: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  try {
    const { body } = await nhost.auth.verifySignUpWebauthn({
      credential,
      nickname: nickname?.trim() || undefined,
      options: { redirectTo: redirectTo(next) },
    });

    return { signedIn: Boolean(body.session) };
  } catch (err) {
    return {
      error: `Could not finish sign up: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}

// No email: the browser offers whichever passkeys it holds for this site.
export async function beginSignIn(): Promise<
  ActionResult & { options?: PublicKeyCredentialRequestOptions }
> {
  try {
    const { body } = await nhost.auth.signInWebauthn();

    return { options: body };
  } catch (err) {
    return {
      error: `Could not start sign in: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}

const PASSKEY_NOT_REGISTERED =
  'That passkey is not registered with this app. If your browser offered more than one, choose another.';

// A successful verify is the sign-in: the client stores the session it answers
// with, so the caller only has to navigate.
export async function finishSignIn(
  credential: CredentialAssertionResponse,
): Promise<ActionResult & { success?: boolean }> {
  try {
    const { body } = await nhost.auth.verifySignInWebauthn({ credential });

    if (!body.session) {
      return { error: 'That passkey was not accepted.' };
    }

    return { success: true };
  } catch (err) {
    // The browser offers every passkey it holds for this domain, including
    // ones this app deleted or never registered, such as another app's on
    // localhost. Auth rejects those with a 400.
    if ((err as FetchError).status === 400) {
      return { error: PASSKEY_NOT_REGISTERED };
    }

    return {
      error: `Could not sign in: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}
