import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { nhost } from '@/lib/nhost/client';
import { type ActionResult, errorMessage, RETRY_IN } from '@/lib/nhost/errors';
import { startFlow } from '@/lib/nhost/links';
import { signInDestination } from '@/screens/signin/destination';

// A passkey ceremony is two round trips with the device's step in between: the
// backend issues a challenge, the authenticator signs it, the backend checks
// the signature.

// No `redirectTo` here: auth takes the one sent with the verify, which is the
// request that sends the verification email.
export async function beginSignUp(
  email: string,
): Promise<ActionResult & { options?: PublicKeyCredentialCreationOptions }> {
  const address = email.trim();
  if (!address) {
    return { error: 'Email is required.' };
  }

  try {
    const { body } = await nhost.auth.signUpWebauthn({ email: address });

    return { options: body };
  } catch (err) {
    return {
      error: `Could not start sign up: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}

// Returns `signedIn: true` only when the backend has email verification off.
// Otherwise the verification link signs this device in.
export async function finishSignUp(
  credential: CredentialCreationResponse,
  next: string,
  nickname?: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  try {
    const { codeChallenge, redirectTo } = await startFlow(
      'emailVerify',
      signInDestination(next),
    );
    const { body } = await nhost.auth.verifySignUpWebauthn({
      credential,
      nickname: nickname?.trim() || undefined,
      options: { redirectTo },
      codeChallenge,
    });

    return { signedIn: Boolean(body.session) };
  } catch (err) {
    return {
      error: `Could not finish sign up: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}

// No email: the device offers whichever passkeys it holds for this app.
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
  'That passkey is not registered with this app. If your device offered more than one, choose another.';

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
    // The device offers every passkey it holds for this domain, including
    // ones this app deleted. Auth rejects those with a 400.
    if ((err as FetchError).status === 400) {
      return { error: PASSKEY_NOT_REGISTERED };
    }

    return {
      error: `Could not sign in: ${errorMessage(err, RETRY_IN.signIn)}`,
    };
  }
}
