'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { graphql } from '@/gql';
import { MAX_AVATAR_BYTES } from '@/lib/avatar';
import { gqlRequest } from '@/lib/graphql';
import { appOrigin } from '@/lib/nhost/env';
import {
  clearPasswordResetGrant,
  createNhostClient,
  passwordResetGrantUserId,
} from '@/lib/nhost/server';

type ActionResult = { error?: string; success?: boolean };

const SetDisplayName = graphql(`
  mutation SetDisplayName($id: uuid!, $displayName: String!) {
    updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {
      id
      displayName
    }
  }
`);

const GetUserMetadata = graphql(`
  query GetUserMetadata($id: uuid!) {
    user(id: $id) {
      id
      metadata
    }
  }
`);

// Whether the account has a password is the server's own fact, not something
// the caller gets to assert. See `changePassword`.
const GetHasPassword = graphql(`
  query GetHasPassword($id: uuid!) {
    user(id: $id) {
      id
      hasPassword
    }
  }
`);

// Deliberately a read-merge-write with _set rather than Hasura's _append /
// _delete_key: those concatenate, and on a user whose metadata is JSON null
// they produce an array instead of an object.
const SetUserMetadata = graphql(`
  mutation SetUserMetadata($id: uuid!, $metadata: jsonb!) {
    updateUser(pk_columns: { id: $id }, _set: { metadata: $metadata }) {
      id
    }
  }
`);

async function userMetadata(
  nhost: Awaited<ReturnType<typeof createNhostClient>>,
  id: string,
): Promise<Record<string, unknown>> {
  const { user } = await gqlRequest(nhost, GetUserMetadata, { id });
  const metadata = user?.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export async function updateDisplayName(
  displayName: string,
): Promise<ActionResult> {
  const name = displayName.trim();
  if (!name) {
    return { error: 'A display name is required.' };
  }

  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;
  if (!user) {
    return { error: 'Sign in to change your display name.' };
  }

  try {
    await gqlRequest(nhost, SetDisplayName, {
      id: user.id,
      displayName: name,
    });
    return { success: true };
  } catch (err) {
    return { error: `Could not save the name: ${(err as Error).message}` };
  }
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image first.' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: 'The image is too large. Keep it under 4 MB.' };
  }

  const nhost = await createNhostClient();
  if (!nhost.getUserSession()) {
    return { error: 'Sign in to change your avatar.' };
  }

  const image = Buffer.from(await file.arrayBuffer()).toString('base64');

  try {
    await nhost.functions.post('/avatar', { image });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<{ error?: string }>;
    return {
      error: `Could not upload the avatar: ${error.body?.error ?? error.message}`,
    };
  }
}

export async function removeAvatar(): Promise<ActionResult> {
  const nhost = await createNhostClient();
  if (!nhost.getUserSession()) {
    return { error: 'Sign in to change your avatar.' };
  }

  try {
    await nhost.functions.post('/avatar', { remove: true });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<{ error?: string }>;
    return {
      error: `Could not remove the avatar: ${error.body?.error ?? error.message}`,
    };
  }
}

/**
 * Proves the caller can act on this account right now: the current password
 * when it has one, or a code just emailed to it when it does not.
 *
 * Shared by `changeEmail` and `changePassword` so the two credential-changing
 * actions cannot drift: whichever one is updated, the other keeps asking for
 * the same proof. An account with no password has none to prove, so a fresh
 * `verifySignInOTPEmail` stands in - the same "this browser controls the
 * mailbox" proof `changePassword`'s reset-link grant already relies on.
 * Passing this unconditionally on a passwordless account would leave a stolen
 * session (the cookie is JS-readable, see `cookieOptions` in `server.ts`) able
 * to set a password and redirect the login email with nothing but the cookie -
 * exactly the takeover this function exists to block for accounts that do have
 * a password.
 */
async function requireCurrentPasswordProof(
  nhost: Awaited<ReturnType<typeof createNhostClient>>,
  userId: string,
  email: string,
  currentPassword: string | undefined,
): Promise<{ error: string } | null> {
  let accountHasPassword: boolean;
  try {
    const { user: row } = await gqlRequest(nhost, GetHasPassword, {
      id: userId,
    });
    accountHasPassword = row?.hasPassword === true;
  } catch (err) {
    return {
      error: `Could not check the current password: ${(err as Error).message}`,
    };
  }

  if (!accountHasPassword) {
    if (!currentPassword) {
      return {
        error: 'Enter the code we emailed you to confirm this change.',
      };
    }

    try {
      await nhost.auth.verifySignInOTPEmail({ email, otp: currentPassword });
    } catch {
      return { error: 'That code is not valid.' };
    }

    return null;
  }

  if (!currentPassword) {
    return { error: 'Enter your current password to change it.' };
  }

  try {
    await nhost.auth.signInEmailPassword({ email, password: currentPassword });
  } catch {
    return { error: 'That is not your current password.' };
  }

  return null;
}

/**
 * Emails a one-time code to the signed-in account's own address.
 *
 * The only proof `requireCurrentPasswordProof` accepts from an account with no
 * password: it always goes to the mailbox on file rather than one the caller
 * supplies, so a stolen session cookie alone cannot produce it.
 */
export async function sendReauthCode(): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const email = nhost.getUserSession()?.user?.email;
  if (!email) {
    return { error: 'Sign in to request a code.' };
  }

  try {
    await nhost.auth.signInOTPEmail({ email });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the code: ${error.message}` };
  }
}

/**
 * Requests an email change, confirmed from the new address.
 *
 * A session alone is not enough: unlike a password change, this backend
 * primitive notifies only the new address, never the old one, so a stolen
 * session that could change the login email unchallenged would let its holder
 * confirm from a mailbox they control and walk straight into "forgot
 * password" - the same permanent takeover `changePassword` guards against.
 * `requireCurrentPasswordProof` closes that the same way changing the
 * password does.
 */
export async function changeEmail(
  newEmail: string,
  currentPassword?: string,
): Promise<ActionResult> {
  if (!newEmail) {
    return { error: 'An email address is required.' };
  }

  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;
  const email = user?.email;
  if (!user || !email) {
    return { error: 'Sign in to change your email.' };
  }

  const proofError = await requireCurrentPasswordProof(
    nhost,
    user.id,
    email,
    currentPassword,
  );
  if (proofError) {
    return proofError;
  }

  try {
    await nhost.auth.changeUserEmail({
      newEmail,
      options: { redirectTo: `${appOrigin()}/profile` },
    });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not request the change: ${error.message}` };
  }
}

/**
 * Sets or changes the password, then signs back in on the new one.
 *
 * Changing a password revokes every refresh token for the account, including
 * the one behind the current session, which is what should happen: a password
 * change has to boot whoever else was signed in. Without the sign-in that
 * follows, it also boots the person who just made the change.
 *
 * Setting a password on an account that already has one needs one of two
 * proofs, and the server decides which it got. Knowing the current password is
 * one: `currentPassword` is verified by signing in with it, because Nhost's own
 * endpoint does not ask for it. Having just followed a reset link is the other,
 * and the proxy records that as a grant cookie when it redeems the link, so the
 * client cannot claim it by leaving an argument out. An account with no
 * password yet goes through `requireCurrentPasswordProof` instead, which reuses
 * `currentPassword` to carry a one-time code from `sendReauthCode` rather than
 * letting the change through unchallenged.
 *
 * The grant names the account it was issued for, and is only accepted for that
 * account. Without the comparison it would mean no more than "some reset link
 * was redeemed in this browser" - equally true of a browser that redeemed one
 * for a *different* account, and spending that here would set this account's
 * password on the strength of proof about somebody else's.
 */
export async function changePassword(
  newPassword: string,
  currentPassword?: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A password is required.' };
  }

  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;
  const email = user?.email;
  if (!user || !email) {
    return { error: 'Sign in to change your password.' };
  }

  // A grant issued for somebody else is no grant at all.
  const resetGrant = (await passwordResetGrantUserId()) === user.id;

  if (!resetGrant) {
    const proofError = await requireCurrentPasswordProof(
      nhost,
      user.id,
      email,
      currentPassword,
    );
    if (proofError) {
      return proofError;
    }
  }

  try {
    await nhost.auth.changeUserPassword({ newPassword });
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not change the password: ${error.message}` };
  }

  // Spent only once it has actually been used, so a rejected password (too
  // short, say) leaves the reset link still usable.
  if (resetGrant) {
    await clearPasswordResetGrant();
  }

  try {
    await nhost.auth.signInEmailPassword({ email, password: newPassword });
  } catch {
    return {
      error:
        'Your password was changed, but this device was signed out. Sign in with the new password.',
    };
  }

  return { success: true };
}

export async function sendOwnPasswordReset(): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const email = nhost.getUserSession()?.user?.email;
  if (!email) {
    return { error: 'Sign in to reset your password.' };
  }

  try {
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: `${appOrigin()}/reset-password` },
    });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the reset link: ${error.message}` };
  }
}

/**
 * Publishes or unpublishes the profile at `/u/<id>`.
 *
 * This is the master switch the `public` role reads. While it is off that role
 * cannot see the account, its shared items, or their photos, whatever is
 * flagged on the individual rows, so turning it off is a complete retraction
 * rather than just hiding the page.
 *
 * It goes through the same read-merge-write as the delete flow because they
 * share one `metadata` column: a blind `_set` here would drop `deletedAt`.
 */
export async function setProfilePublished(
  published: boolean,
): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;
  if (!user) {
    return { error: 'Sign in to change who can see your profile.' };
  }

  try {
    const { publicProfile: _, ...metadata } = await userMetadata(
      nhost,
      user.id,
    );
    await gqlRequest(nhost, SetUserMetadata, {
      id: user.id,
      metadata: published ? { ...metadata, publicProfile: true } : metadata,
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not update your profile visibility: ${(err as Error).message}`,
    };
  }
}

export async function deleteAccount(): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  if (!session?.user) {
    return { error: 'Sign in to delete your account.' };
  }

  try {
    const metadata = await userMetadata(nhost, session.user.id);
    await gqlRequest(nhost, SetUserMetadata, {
      id: session.user.id,
      metadata: { ...metadata, deletedAt: new Date().toISOString() },
    });
  } catch (err) {
    return { error: `Could not delete the account: ${(err as Error).message}` };
  }

  // Every device is signed out; signing back in during the grace period is
  // what offers the restore.
  try {
    await nhost.auth.signOut({ refreshToken: session.refreshToken, all: true });
  } catch (err) {
    console.error('Could not sign out after deleting the account:', err);

    // The session cookie carries its own snapshot of `metadata`, stale until
    // the next token refresh, so leaving it in place here would let this
    // device keep acting as a signed-in, deleted account until that refresh
    // happens. `nhost.clearSession()` only touches local storage (see the
    // SDK's `clearSession` doc comment) - it does not call the backend - so
    // it succeeds even though the network call above just failed, and it is
    // what actually signs this device out. Telling the user to sign out
    // manually would retry the same rejected refresh token and fail the same
    // way.
    nhost.clearSession();

    return {
      success: true,
      error:
        'Your account is marked deleted, and this device has been signed out. Sign in again within 30 days to restore it.',
    };
  }

  return { success: true };
}

export async function restoreAccount(): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;
  if (!user) {
    return { error: 'Sign in to restore your account.' };
  }

  try {
    const { deletedAt: _, ...metadata } = await userMetadata(nhost, user.id);
    await gqlRequest(nhost, SetUserMetadata, { id: user.id, metadata });
  } catch (err) {
    return {
      error: `Could not restore the account: ${(err as Error).message}`,
    };
  }

  return syncRestoredSession();
}

/**
 * Reloads the session so it stops carrying a deletion mark the database no
 * longer has.
 *
 * The mark rides in the session as well as in the database, and the proxy
 * reads the session's copy. `refreshSession` hands back the existing session
 * untouched while its access token is still valid, so the stale mark would sit
 * there for up to the token's lifetime - and every page would bounce to
 * `/restore` for that whole window. Forcing the refresh is what reloads
 * `metadata`.
 *
 * `/restore` offers this as a button because more than one device can hold a
 * marked session: restoring on a laptop leaves a phone signed in with the old
 * one, and only a request from that device can fix that device's cookie.
 */
export async function syncRestoredSession(): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const refreshToken = nhost.getUserSession()?.refreshToken;

  if (!refreshToken) {
    return { error: 'Sign in to restore your account.' };
  }

  try {
    const { body } = await nhost.auth.refreshToken({ refreshToken });
    nhost.sessionStorage.set(body);
  } catch (err) {
    // Reported rather than swallowed: until this succeeds the session still
    // says the account is deleted, and the proxy acts on that. Two tabs both
    // pressing the button is enough to land here, because the first rotates
    // the refresh token the second is still holding.
    console.error('Could not refresh the session after restoring:', err);

    return {
      error:
        'Your account is restored, but this device is still signed in as deleted. Sign out and back in to finish.',
    };
  }

  return { success: true };
}
