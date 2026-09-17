'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { headers } from 'next/headers';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

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

// Auth emails link back into the app, so redirect targets need this request's
// own origin: the template does not know where it is deployed.
async function appOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
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
      options: { redirectTo: `${await appOrigin()}/profile` },
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
 * `currentPassword` is required once an account has a password. Nhost's own
 * endpoint does not ask for it (that is what elevated privileges are for), so
 * it is checked here by signing in with it first.
 */
export async function changePassword(
  newPassword: string,
  currentPassword?: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A password is required.' };
  }

  const nhost = await createNhostClient();
  const email = nhost.getUserSession()?.user?.email;
  if (!email) {
    return { error: 'Sign in to change your password.' };
  }

  if (currentPassword) {
    try {
      await nhost.auth.signInEmailPassword({
        email,
        password: currentPassword,
      });
    } catch {
      return { error: 'That is not your current password.' };
    }
  }

  try {
    await nhost.auth.changeUserPassword({ newPassword });
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not change the password: ${error.message}` };
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
      options: { redirectTo: `${await appOrigin()}/reset-password` },
    });
    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the reset link: ${error.message}` };
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
    return { success: true };
  } catch (err) {
    return {
      error: `Could not restore the account: ${(err as Error).message}`,
    };
  }
}
