'use server';

import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import {
  AVATAR_TOO_LARGE,
  avatarFileIdFrom,
  avatarUrlFor,
  isAvatarType,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { signOut } from '@/lib/nhost/actions';
import { appOrigin } from '@/lib/nhost/env';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';
import {
  createNhostClient,
  getVerifiedUser,
  updateSessionUser,
} from '@/lib/nhost/server';
import type { SessionMetadata } from '@/lib/nhost/session-metadata';

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
//
// The auth service revokes every session with the old password, this one
// included, so every other device is signed out. This browser then signs
// straight back in with the new password, which is already here, so changing
// it does not cost the visitor their place. That takes an email address and
// no second factor: without them, or if the sign-in fails, `signedIn` is
// false and the page asks for a fresh sign-in, as before.
export async function changePassword(
  newPassword: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    const email = session.user?.email;
    if (!email) {
      return { success: true, signedIn: false };
    }

    try {
      const { body } = await nhost.auth.signInEmailPassword({
        email,
        password: newPassword,
      });

      return { success: true, signedIn: Boolean(body.session) };
    } catch (err) {
      console.error('Could not sign back in after the password change:', err);
      return { success: true, signedIn: false };
    }
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

    updateSessionUser(nhost, { displayName: trimmed });

    return { success: true };
  } catch (err) {
    return { error: `Could not save the display name: ${errorMessage(err)}` };
  }
}

// Returns why the account's avatar could not be set to `avatarUrl`, or
// undefined once it is. An empty string is how the account is left with no
// avatar at all.
async function setAvatarUrl(
  nhost: NhostClient,
  userId: string,
  avatarUrl: string,
): Promise<string | undefined> {
  try {
    const { body } = await nhost.graphql.request<{
      updateUser: { id: string } | null;
    }>({
      query: `mutation UpdateAvatar($id: uuid!, $avatarUrl: String!) {
        updateUser(pk_columns: { id: $id }, _set: { avatarUrl: $avatarUrl }) {
          id
        }
      }`,
      variables: { id: userId, avatarUrl },
    });

    if (body.errors?.length) {
      return graphqlErrorMessage(body.errors);
    }

    if (!body.data?.updateUser) {
      return 'The backend did not update this account.';
    }

    return undefined;
  } catch (err) {
    return `Could not update the avatar: ${errorMessage(err)}`;
  }
}

// Three steps: the file goes to storage, which inserts its row as this user
// under the insert permission in nhost/metadata; the account's avatar_url is
// pointed at the route handler that serves it; and the file the previous
// avatar pointed at, if this app wrote it, is deleted so storage does not
// collect one per change. The previous avatar comes from the auth service, not
// the session cookie: the cookie is patched by this app's own actions and
// otherwise rewritten on refresh, so a change made in another browser can be
// missing from it for an access token's life, and anyone can write one anyway.
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const file = formData.get('avatar');

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image first.' };
  }

  if (!isAvatarType(file.type)) {
    return { error: 'Use a PNG, JPEG, GIF, WebP or AVIF image.' };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { error: AVATAR_TOO_LARGE };
  }

  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { error: SIGNED_OUT };
    }

    const nhost = await createNhostClient();
    const { body: uploaded } = await nhost.storage.uploadFiles({
      'bucket-id': 'default',
      'file[]': [file],
    });
    const fileId = uploaded.processedFiles[0]?.id;

    if (!fileId) {
      return { error: 'The storage service did not keep the file.' };
    }

    const failure = await setAvatarUrl(nhost, user.id, avatarUrlFor(fileId));

    if (failure) {
      // Nothing should refer to the new file, and only this request knows
      // its id.
      await nhost.storage.deleteFile(fileId).catch((err: unknown) => {
        console.error('Could not delete the unused avatar:', err);
      });
      return { error: failure };
    }

    updateSessionUser(nhost, { avatarUrl: avatarUrlFor(fileId) });

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

// The account stops pointing at an avatar first, then the file goes. That way
// round a failure leaves the account showing an avatar that still exists,
// where deleting first would leave it pointing at nothing.
//
// Clearing `avatar_url` works whatever it held, so the gravatar a fresh
// account starts with can be taken down too. Deleting the file behind it only
// happens for one this app wrote: `avatar_url` is the user's to set, so
// anything else there names nothing of ours.
export async function removeAvatar(): Promise<ActionResult> {
  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { error: SIGNED_OUT };
    }

    if (!user.avatarUrl) {
      return { error: 'There is no avatar to remove.' };
    }

    const nhost = await createNhostClient();
    const failure = await setAvatarUrl(nhost, user.id, '');

    if (failure) {
      return { error: failure };
    }

    updateSessionUser(nhost, { avatarUrl: '' });

    const fileId = avatarFileIdFrom(user.avatarUrl);
    if (fileId) {
      // The account already shows no avatar; a leftover file is worth a log
      // line, not a failure the visitor has to act on.
      await nhost.storage.deleteFile(fileId).catch((err: unknown) => {
        console.error('Could not delete the removed avatar:', err);
      });
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not remove the avatar: ${errorMessage(err)}` };
  }
}

// Closing the account for good. The avatar goes first, because deleting the
// row cascades through the auth schema but leaves a storage file behind, and
// once the row is gone there is no session left to delete the file with.
//
// The sign-out at the end is only there to clear this browser's cookies. The
// refresh tokens went with the row, so the session they describe is already
// dead; a cookie pointing at a deleted account would otherwise sit here until
// the next navigation noticed.
export async function deleteAccount(): Promise<ActionResult> {
  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { error: SIGNED_OUT };
    }

    const nhost = await createNhostClient();
    const fileId = avatarFileIdFrom(user.avatarUrl);

    if (fileId) {
      await nhost.storage.deleteFile(fileId).catch((err: unknown) => {
        console.error('Could not delete the avatar of a closing account:', err);
      });
    }

    const { body } = await nhost.graphql.request<{
      deleteUser: { id: string } | null;
    }>({
      query: `mutation DeleteAccount($id: uuid!) {
        deleteUser(id: $id) {
          id
        }
      }`,
      variables: { id: user.id },
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    if (!body.data?.deleteUser) {
      return { error: 'The backend did not delete this account.' };
    }

    await signOut();

    return { success: true };
  } catch (err) {
    return { error: `Could not delete the account: ${errorMessage(err)}` };
  }
}

// For an address that was never verified: sign-up sent one link, this sends
// another. The address comes from the auth service's own answer about who is
// signed in, not from the caller, so this cannot be pointed at someone else.
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

export type AccountSession = {
  id: string;
  createdAt: string;
  metadata: SessionMetadata | null;
  current: boolean;
};

// Every browser signed in to the account, from the refresh tokens' rows and
// the permission on them in nhost/metadata. `metadata` is what the proxy wrote
// on the session's visits (see `trackSession` in `@/lib/nhost/server`), so a
// session that has not made a request since this app started recording has
// none. An expired row lingers until the auth service cleans it up, and can
// no longer sign anyone in, so it is left out.
export async function listSessions(): Promise<
  ActionResult & { sessions?: AccountSession[] }
> {
  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.graphql.request<{
      authRefreshTokens: Omit<AccountSession, 'current'>[];
    }>({
      query: `query Sessions {
        authRefreshTokens(
          where: { expiresAt: { _gt: "now()" } }
          order_by: { createdAt: desc }
        ) { id createdAt metadata }
      }`,
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    return {
      sessions: (body.data?.authRefreshTokens ?? []).map((row) => ({
        ...row,
        current: row.id === session.refreshTokenId,
      })),
    };
  } catch (err) {
    return { error: `Could not list the sessions: ${errorMessage(err)}` };
  }
}

// Revokes one other session. Its access token keeps working until the proxy
// on that device next looks for the row, which is its next page load.
//
// Not this one: deleting the row under the session in use would leave this
// browser holding cookies for a session that is gone, and the nav already
// signs out here properly.
export async function signOutSession(id: string): Promise<ActionResult> {
  if (!id) {
    return { error: 'Which session?' };
  }

  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return { error: SIGNED_OUT };
    }

    if (id === session.refreshTokenId) {
      return {
        error:
          'This is the session you are using. Sign out from the menu instead.',
      };
    }

    const { body } = await nhost.graphql.request<{
      deleteAuthRefreshToken: { id: string } | null;
    }>({
      query: `mutation SignOutSession($id: uuid!) {
        deleteAuthRefreshToken(id: $id) { id }
      }`,
      variables: { id },
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    if (!body.data?.deleteAuthRefreshToken) {
      return { error: 'That session is not on this account.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not sign out the session: ${errorMessage(err)}` };
  }
}
