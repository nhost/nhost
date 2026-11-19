import type { NhostClient } from '@nhost/nhost-js';
import * as v from 'valibot';
import { signOut } from '#lib/nhost/actions.remote.ts';
import { appOrigin } from '#lib/nhost/env.server.ts';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
  SIGNED_OUT,
} from '#lib/nhost/errors.ts';
import { graphqlErrorMessage } from '#lib/nhost/graphql.ts';
import {
  createNhostClient,
  getVerifiedUser,
  updateSessionUser,
} from '#lib/nhost/server.ts';
import { command, form, query } from '$app/server';
import {
  AVATAR_TOO_LARGE,
  avatarFileIdFrom,
  avatarUrlFor,
  isAvatarType,
  MAX_AVATAR_BYTES,
} from './avatar.ts';

// Where the links in the emails below land. Fixed rather than taken from the
// caller, so nothing here can aim a link at another host.
const ACCOUNT_URL = () => `${appOrigin()}/account`;

// Sends a confirmation link to the new address. The change happens when that
// link is opened, not here: until then the old address is the account's.
export const changeEmail = command(
  v.string(),
  async (newEmail): Promise<ActionResult> => {
    if (!newEmail) {
      return { error: 'A new email address is required.' };
    }

    try {
      const nhost = createNhostClient();

      if (!nhost.getUserSession()) {
        return { error: SIGNED_OUT };
      }

      await nhost.auth.changeUserEmail({
        newEmail,
        options: { redirectTo: ACCOUNT_URL() },
      });

      return { success: true };
    } catch (err) {
      return {
        error: `Could not start the email change: ${errorMessage(err, RETRY_IN.email)}`,
      };
    }
  },
);

// The auth API has no write endpoint for a profile field, so this goes through
// GraphQL and the update permission in nhost/metadata.
export const updateDisplayName = command(
  v.string(),
  async (displayName): Promise<ActionResult> => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      return { error: 'A display name is required.' };
    }

    try {
      const nhost = createNhostClient();
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
  },
);

// Returns why the account's avatar could not be set to `avatarUrl`, or
// undefined once it is.
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

// The file goes to storage, the account's avatar_url is pointed at the route
// that serves it, and the file the previous avatar named is deleted. A form
// rather than a command: a form posts the file as it is, where a command
// encodes it at almost twice the size, past the 4.5 MB Vercel accepts.
export const uploadAvatar = form(
  v.object({ avatar: v.optional(v.file()) }),
  async ({ avatar: file }): Promise<ActionResult> => {
    if (!file || file.size === 0) {
      return { error: 'Choose an image first.' };
    }

    if (!isAvatarType(file.type)) {
      return { error: 'Use a PNG, JPEG, WebP or AVIF image.' };
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return { error: AVATAR_TOO_LARGE };
    }

    try {
      const user = await getVerifiedUser();

      if (!user) {
        return { error: SIGNED_OUT };
      }

      const nhost = createNhostClient();
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
  },
);

// The account stops pointing at an avatar first, then the file goes.
export const removeAvatar = command(async (): Promise<ActionResult> => {
  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { error: SIGNED_OUT };
    }

    if (!user.avatarUrl) {
      return { error: 'There is no avatar to remove.' };
    }

    const nhost = createNhostClient();
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
});

// Closing the account for good. The avatar goes first: deleting the row
// leaves a storage file behind, and no session to delete it with.
export const deleteAccount = command(async (): Promise<ActionResult> => {
  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { error: SIGNED_OUT };
    }

    const nhost = createNhostClient();
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
});

// For an address that was never verified: sign-up sent one link, this sends
// another.
export const resendVerification = command(async (): Promise<ActionResult> => {
  try {
    const user = await getVerifiedUser();

    if (!user?.email) {
      return { error: SIGNED_OUT };
    }

    const nhost = createNhostClient();
    await nhost.auth.sendVerificationEmail({
      email: user.email,
      options: { redirectTo: ACCOUNT_URL() },
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the verification email: ${errorMessage(err, RETRY_IN.email)}`,
    };
  }
});

export type AccountSession = {
  id: string;
  createdAt: string;
  current: boolean;
};

// Every browser signed in to the account, from the refresh tokens' rows and the
// permission on them in nhost/metadata.
export const listSessions = query(
  async (): Promise<ActionResult & { sessions?: AccountSession[] }> => {
    try {
      const nhost = createNhostClient();
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
        ) { id createdAt }
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
  },
);

// Revokes one other session. Not this one: the nav signs this browser out
// properly, cookies included.
export const signOutSession = command(
  v.string(),
  async (id): Promise<ActionResult> => {
    if (!id) {
      return { error: 'Which session?' };
    }

    try {
      const nhost = createNhostClient();
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
  },
);
