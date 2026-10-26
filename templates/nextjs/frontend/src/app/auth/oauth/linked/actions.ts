'use server';

import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';
import { createNhostClient, getVerifiedUser } from '@/lib/nhost/server';
import { leavesAWayIn } from './wayIn';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

const SIGNED_OUT = 'You are signed out. Sign in and try again.';

export type LinkedAccount = {
  id: string;
  providerId: string;
  createdAt: string;
};

// Linking goes through the auth service (see `[provider]/connect`); listing
// and unlinking go through GraphQL and the permissions on
// `auth.user_providers` in nhost/metadata, which leave out the provider's
// tokens.
export async function listLinkedAccounts(): Promise<
  ActionResult & { links?: LinkedAccount[] }
> {
  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.graphql.request<{
      authUserProviders: LinkedAccount[];
    }>({
      query: `query LinkedAccounts {
        authUserProviders { id providerId createdAt }
      }`,
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    return { links: body.data?.authUserProviders ?? [] };
  } catch (err) {
    return {
      error: `Could not list the linked accounts: ${errorMessage(err)}`,
    };
  }
}

// The account and its links come from the backend, not the caller, so the
// caller cannot talk its way past `leavesAWayIn`. The permission filters by
// user, so someone else's link deletes nothing.
export async function unlinkProvider(id: string): Promise<ActionResult> {
  if (!id) {
    return { error: 'Which account?' };
  }

  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { error: SIGNED_OUT };
    }

    const { links, error } = await listLinkedAccounts();
    if (error) {
      return { error };
    }

    if (!leavesAWayIn(user.email, links?.length ?? 0)) {
      return {
        error:
          'This is the only way to sign in to this account, so it stays linked.',
      };
    }

    const nhost = await createNhostClient();
    const { body } = await nhost.graphql.request<{
      deleteAuthUserProvider: { id: string } | null;
    }>({
      query: `mutation UnlinkProvider($id: uuid!) {
        deleteAuthUserProvider(id: $id) { id }
      }`,
      variables: { id },
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    if (!body.data?.deleteAuthUserProvider) {
      return { error: 'That account is not linked to this one.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not unlink the account: ${errorMessage(err)}` };
  }
}
