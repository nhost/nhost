'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import {
  AVATAR_TOO_LARGE,
  avatarFileIdFrom,
  avatarUrlFor,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { appOrigin } from '@/lib/nhost/env';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';
import { createNhostClient, getVerifiedUser } from '@/lib/nhost/server';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
export type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

const SIGNED_OUT = 'You are signed out. Sign in and try again.';

// Where the links in the emails below land. Fixed rather than taken from the
// caller, so nothing here can aim a link at another host.
const ACCOUNT_URL = () => `${appOrigin()}/account`;

// The auth service takes the new password and nothing else: no current
// password, and no check that one was ever set, so this works for an account
// created by magic link as much as one created with a password. A signed-in
// session is what authorises the change, which is why the form says so
// rather than asking for something it would not use.
export async function changePassword(
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    return { success: true };
  } catch (err) {
    return { error: `Could not change the password: ${errorMessage(err)}` };
  }
}

// Sends a confirmation link to the new address. The change happens when that
// link is opened, not here: until then the old address is the account's.
export async function changeEmail(newEmail: string): Promise<ActionResult> {
  if (!newEmail) {
    return { error: 'A new email address is required.' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.changeUserEmail({
      newEmail,
      options: { redirectTo: ACCOUNT_URL() },
    });

    return { success: true };
  } catch (err) {
    return { error: `Could not start the email change: ${errorMessage(err)}` };
  }
}

// For an address that was never verified: sign-up sent one link, this sends
// another. The address comes from the auth service's own answer about who is
// signed in, not from the caller, so this cannot be pointed at someone else.
// The auth API has no write endpoint for a profile field, so this goes
// through GraphQL and the update permission in nhost/metadata. The id comes
// from the session cookie, which anyone can write, but the permission filters
// by the user in the token, so a forged id updates nothing rather than
// someone else.
export async function updateDisplayName(
  displayName: string,
): Promise<ActionResult> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { error: 'A display name is required.' };
  }

  try {
    const nhost = await createNhostClient();
    const id = nhost.getUserSession()?.user?.id;

    if (!id) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.graphql.request<{
      updateUser: { id: string } | null;
    }>({
      query: `mutation UpdateDisplayName($id: uuid!, $displayName: String!) {
        updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName }) {
          id
        }
      }`,
      variables: { id, displayName: trimmed },
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    if (!body.data?.updateUser) {
      return { error: 'The backend did not update this account.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not save the display name: ${errorMessage(err)}` };
  }
}

// Three steps: the file goes to storage, which inserts its row as this user
// under the insert permission in nhost/metadata; the account's avatar_url is
// pointed at the route handler that serves it; and the file the previous
// avatar pointed at, if this app wrote it, is deleted so storage does not
// collect one per change.
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const file = formData.get('avatar');

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image first.' };
  }

  if (!file.type.startsWith('image/')) {
    return { error: 'That is not an image.' };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { error: AVATAR_TOO_LARGE };
  }

  try {
    const nhost = await createNhostClient();
    const user = nhost.getUserSession()?.user;

    if (!user) {
      return { error: SIGNED_OUT };
    }

    const { body: uploaded } = await nhost.storage.uploadFiles({
      'bucket-id': 'default',
      'file[]': [file],
    });
    const fileId = uploaded.processedFiles[0]?.id;

    if (!fileId) {
      return { error: 'The storage service did not keep the file.' };
    }

    const { body } = await nhost.graphql.request<{
      updateUser: { id: string } | null;
    }>({
      query: `mutation UpdateAvatar($id: uuid!, $avatarUrl: String!) {
        updateUser(pk_columns: { id: $id }, _set: { avatarUrl: $avatarUrl }) {
          id
        }
      }`,
      variables: { id: user.id, avatarUrl: avatarUrlFor(fileId) },
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    if (!body.data?.updateUser) {
      return { error: 'The backend did not update this account.' };
    }

    const previous = avatarFileIdFrom(user.avatarUrl);
    if (previous && previous !== fileId) {
      // The new avatar is already in place; a leftover file is worth a log
      // line, not a failure the visitor has to act on.
      await nhost.storage.deleteFile(previous).catch((err: unknown) => {
        console.error('Could not delete the previous avatar:', err);
      });
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not upload the avatar: ${errorMessage(err)}` };
  }
}

export async function resendVerification(): Promise<ActionResult> {
  try {
    const user = await getVerifiedUser();

    if (!user?.email) {
      return { error: SIGNED_OUT };
    }

    const nhost = await createNhostClient();
    await nhost.auth.sendVerificationEmail({
      email: user.email,
      options: { redirectTo: ACCOUNT_URL() },
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the verification email: ${errorMessage(err)}`,
    };
  }
}
