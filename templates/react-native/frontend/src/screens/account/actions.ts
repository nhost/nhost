import { signOut } from '@/lib/nhost/actions';
import {
  getVerifiedUser,
  nhost,
  updateSessionUser,
  type VerifiedUser,
} from '@/lib/nhost/client';
import {
  type ActionResult,
  AUTH_UNAVAILABLE,
  errorMessage,
  RETRY_IN,
  SIGNED_OUT,
} from '@/lib/nhost/errors';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';
import { startFlow } from '@/lib/nhost/links';

// Where the links in the emails below land. Fixed rather than taken from the
// caller, so nothing here can aim a link at another screen.
const ACCOUNT_PATH = '/account';

// An auth service that could not answer says nothing about the session.
const unverified = ({
  reason,
}: Extract<VerifiedUser, { user: null }>): string =>
  reason === 'unavailable' ? AUTH_UNAVAILABLE : SIGNED_OUT;

// Sends a confirmation link to the new address. The change happens when that
// link is opened, not here: until then the old address is the account's.
export async function changeEmail(newEmail: string): Promise<ActionResult> {
  if (!newEmail) {
    return { error: 'A new email address is required.' };
  }

  try {
    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    const { codeChallenge, redirectTo } = await startFlow(
      'emailChange',
      ACCOUNT_PATH,
    );
    await nhost.auth.changeUserEmail({
      newEmail,
      options: { redirectTo },
      codeChallenge,
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not start the email change: ${errorMessage(err, RETRY_IN.email)}`,
    };
  }
}

// The auth API has no write endpoint for a profile field, so this goes through
// GraphQL and the update permission in nhost/metadata.
export async function updateDisplayName(
  displayName: string,
): Promise<ActionResult> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { error: 'A display name is required.' };
  }

  try {
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

    updateSessionUser({ displayName: trimmed });

    return { success: true };
  } catch (err) {
    return { error: `Could not save the display name: ${errorMessage(err)}` };
  }
}

// Closing the account for good.
export async function deleteAccount(): Promise<ActionResult> {
  try {
    const verified = await getVerifiedUser();

    if (!verified.user) {
      return { error: unverified(verified) };
    }

    const { body } = await nhost.graphql.request<{
      deleteUser: { id: string } | null;
    }>({
      query: `mutation DeleteAccount($id: uuid!) {
        deleteUser(id: $id) {
          id
        }
      }`,
      variables: { id: verified.user.id },
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
// another.
export async function resendVerification(): Promise<ActionResult> {
  try {
    const verified = await getVerifiedUser();

    if (!verified.user) {
      return { error: unverified(verified) };
    }

    const { email } = verified.user;

    if (!email) {
      return { error: SIGNED_OUT };
    }

    const { codeChallenge, redirectTo } = await startFlow(
      'emailVerify',
      ACCOUNT_PATH,
    );
    await nhost.auth.sendVerificationEmail({
      email,
      options: { redirectTo },
      codeChallenge,
    });

    return { success: true };
  } catch (err) {
    return {
      error: `Could not send the verification email: ${errorMessage(err, RETRY_IN.email)}`,
    };
  }
}

export type AccountSession = {
  id: string;
  createdAt: string;
  current: boolean;
};

// Every device signed in to the account, from the refresh tokens' rows and the
// permission on them in nhost/metadata.
export async function listSessions(): Promise<
  ActionResult & { sessions?: AccountSession[] }
> {
  try {
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
}

// Revokes one other session. Not this one: the nav signs this device out
// properly, stored session included.
export async function signOutSession(id: string): Promise<ActionResult> {
  if (!id) {
    return { error: 'Which session?' };
  }

  try {
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
