import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { appOrigin } from '$lib/nhost/env';
import { signInDestination } from '$lib/signin/destination';

// Every call returns { error } rather than throwing, so a form can show what
// went wrong without a boundary, and none of them navigate: the component
// that called decides where to go next.
type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

// The client stores the session as the response comes back, so a sign-in that
// succeeds here is the sign-in. The caller only has to navigate.
export async function signIn(
  nhost: NhostClient,
  email: string,
  password: string,
): Promise<ActionResult> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
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
// By default it is on, no session comes back, and the verification email's
// link is what signs the user in: it arrives with a refresh token on the URL,
// which `lib/nhost/linkToken.ts` redeems on the next load.
//
// `next` is validated here even though the page already did. The link in the
// email is built from it, so a visitor who followed a crafted link into this
// app with `?next=//somewhere.else` would be sent an email pointing away from
// it. The backend's `allowedUrls` is the backstop; this is what keeps the
// request from relying on it.
export async function signUp(
  nhost: NhostClient,
  email: string,
  password: string,
  next: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const destination = signInDestination(next);

  try {
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

// The reset link signs the user in and lands them on the reset page, which is
// why that page can set a password without asking for the current one.
export async function requestPasswordReset(
  nhost: NhostClient,
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
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
  nhost: NhostClient,
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    if (!nhost.getUserSession()) {
      return { error: 'The reset link has expired. Request another.' };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${errorMessage(err)}` };
  }
}
