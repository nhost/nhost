'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { signInDestination } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

// The server client's storage writes the session cookie, so a sign-in that
// succeeds here is the sign-in. The caller only has to navigate.
export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.auth.signInEmailPassword({ email, password });

    if (!body.session) {
      // MFA or an unverified email: the backend accepted the password but did
      // not issue a session. Neither is set up by this template.
      return { error: 'That account cannot be signed in with a password.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not sign in: ${errorMessage(err)}` };
  }
}

// Returns `signedIn: true` only when the backend has email verification off.
// By default it is on, no session comes back, and the verification email's link
// is what signs the user in: the proxy redeems it and lands them on `next`.
//
// `next` is checked again here even though the page already did: a server
// action is a public endpoint anyone can call with any arguments, and `next`
// is appended to the origin, so a value that is not a path could change the
// host the verification link sends its token to.
export async function signUp(
  email: string,
  password: string,
  next: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const destination = signInDestination(next);

  try {
    const nhost = await createNhostClient();
    const { body } = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: { redirectTo: `${appOrigin()}${destination}` },
    });

    return { success: true, signedIn: Boolean(body.session) };
  } catch (err) {
    return { error: `Could not sign up: ${errorMessage(err)}` };
  }
}

// The reset link signs the user in (the proxy redeems it) and lands them on
// the reset page, which is why that page can set a password without asking
// for the current one.
export async function requestPasswordReset(
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const nhost = await createNhostClient();
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: `${appOrigin()}/auth/password/reset` },
    });

    return { success: true };
  } catch (err) {
    return { error: `Could not send the reset link: ${errorMessage(err)}` };
  }
}

export async function setNewPassword(
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: 'The reset link has expired. Request another.' };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${errorMessage(err)}` };
  }
}
