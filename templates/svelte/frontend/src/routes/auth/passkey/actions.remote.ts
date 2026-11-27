import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import * as v from 'valibot';
import { appOrigin } from '#lib/nhost/env.server.ts';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
} from '#lib/nhost/errors.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { signInDestination } from '#routes/signin/destination.ts';
import { command } from '$app/server';

// A passkey ceremony is two round trips with the browser's step in between: the
// backend issues a challenge, the authenticator signs it, the backend checks
// the signature.

// The browser's answer, which auth checks. Here it only has to be an object.
const answer = <T>() =>
  v.custom<T>((value) => typeof value === 'object' && value !== null);

// `next` is checked again here even though the page already did: a remote
// command is a public endpoint anyone can call with any arguments, and `next`
// is appended to the origin the verification email points at.
function redirectTo(next: string): string {
  return `${appOrigin()}${signInDestination(next)}`;
}

export const beginSignUp = command(
  v.object({ email: v.string(), next: v.string() }),
  async ({
    email,
    next,
  }): Promise<
    ActionResult & { options?: PublicKeyCredentialCreationOptions }
  > => {
    if (!email) {
      return { error: 'Email is required.' };
    }

    try {
      const nhost = createNhostClient();
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
  },
);

// Returns `signedIn: true` only when the backend has email verification off.
export const finishSignUp = command(
  v.object({
    credential: answer<CredentialCreationResponse>(),
    next: v.string(),
    nickname: v.optional(v.string()),
  }),
  async ({
    credential,
    next,
    nickname,
  }): Promise<ActionResult & { signedIn?: boolean }> => {
    try {
      const nhost = createNhostClient();
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
  },
);

// No email: the browser offers whichever passkeys it holds for this site.
export const beginSignIn = command(
  async (): Promise<
    ActionResult & { options?: PublicKeyCredentialRequestOptions }
  > => {
    try {
      const nhost = createNhostClient();
      const { body } = await nhost.auth.signInWebauthn();

      return { options: body };
    } catch (err) {
      return {
        error: `Could not start sign in: ${errorMessage(err, RETRY_IN.signIn)}`,
      };
    }
  },
);

const PASSKEY_NOT_REGISTERED =
  'That passkey is not registered with this app. If your browser offered more than one, choose another.';

// A successful verify is the sign-in: the server client's storage writes the
// session cookie, so the caller only has to navigate.
export const finishSignIn = command(
  answer<CredentialAssertionResponse>(),
  async (credential): Promise<ActionResult> => {
    try {
      const nhost = createNhostClient();
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
  },
);
