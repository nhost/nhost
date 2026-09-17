'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { appOrigin } from '@/lib/nhost/env';
import {
  clearPasswordResetGrant,
  createNhostClient,
  passwordResetGrantUserId,
} from '@/lib/nhost/server';

type ActionResult = { error?: string; success?: boolean };

// Base64 in a JSON body grows the payload by a third, and the functions
// runtime rejects bodies over 6 MB, so the original photo is capped here. The
// avatar function shrinks it far below this before storing.
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

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

export async function changeEmail(newEmail: string): Promise<ActionResult> {
  if (!newEmail) {
    return { error: 'An email address is required.' };
  }

  const nhost = await createNhostClient();
  if (!nhost.getUserSession()) {
    return { error: 'Sign in to change your email.' };
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
 * client cannot claim it by leaving an argument out.
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
    let accountHasPassword: boolean;
    try {
      const { user: row } = await gqlRequest(nhost, GetHasPassword, {
        id: user.id,
      });
      accountHasPassword = row?.hasPassword === true;
    } catch (err) {
      return {
        error: `Could not check the current password: ${(err as Error).message}`,
      };
    }

    if (accountHasPassword) {
      if (!currentPassword) {
        return { error: 'Enter your current password to change it.' };
      }

      try {
        await nhost.auth.signInEmailPassword({
          email,
          password: currentPassword,
        });
      } catch {
        return { error: 'That is not your current password.' };
      }
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
  await nhost.auth.signOut({ refreshToken: session.refreshToken, all: true });

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
