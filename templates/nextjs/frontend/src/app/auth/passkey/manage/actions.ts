'use server';

import type {
  CredentialCreationResponse,
  ErrorResponse,
  PublicKeyCredentialCreationOptions,
} from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';
import { createNhostClient } from '@/lib/nhost/server';

// Same convention as `@/lib/nhost/actions`: return { error }, never throw to
// the client, and never `redirect()` (see the comment there for why).
type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

const SIGNED_OUT = 'You are signed out. Sign in and try again.';

export type Passkey = {
  id: string;
  credentialId: string;
  nickname: string | null;
};

// Listing and removing go through GraphQL, not the auth API, and depend on
// the permissions in nhost/metadata.
export async function listPasskeys(): Promise<
  ActionResult & { keys?: Passkey[] }
> {
  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.graphql.request<{
      authUserSecurityKeys: Passkey[];
    }>({
      query: `query Passkeys {
        authUserSecurityKeys { id credentialId nickname }
      }`,
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    return { keys: body.data?.authUserSecurityKeys ?? [] };
  } catch (err) {
    return { error: `Could not list passkeys: ${errorMessage(err)}` };
  }
}

// Adding is the same two-step ceremony as sign-up, against the signed-in
// account: the backend issues a challenge, the authenticator signs it, the
// backend keeps the public key.
export async function beginAddPasskey(): Promise<
  ActionResult & { options?: PublicKeyCredentialCreationOptions }
> {
  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.auth.addSecurityKey();

    return { options: body };
  } catch (err) {
    return { error: `Could not start adding a passkey: ${errorMessage(err)}` };
  }
}

export async function finishAddPasskey(
  credential: CredentialCreationResponse,
  nickname: string,
): Promise<ActionResult> {
  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    await nhost.auth.verifyAddSecurityKey({
      credential,
      nickname: nickname.trim() || undefined,
    });

    return { success: true };
  } catch (err) {
    return { error: `Could not add the passkey: ${errorMessage(err)}` };
  }
}

// The permission filters by the signed-in user, so an id belonging to
// someone else deletes nothing rather than failing loudly. The count of
// affected rows is what says whether it was this user's to remove.
export async function removePasskey(id: string): Promise<ActionResult> {
  if (!id) {
    return { error: 'Which passkey?' };
  }

  try {
    const nhost = await createNhostClient();

    if (!nhost.getUserSession()) {
      return { error: SIGNED_OUT };
    }

    const { body } = await nhost.graphql.request<{
      deleteAuthUserSecurityKey: { id: string } | null;
    }>({
      query: `mutation RemovePasskey($id: uuid!) {
        deleteAuthUserSecurityKey(id: $id) { id }
      }`,
      variables: { id },
    });

    if (body.errors?.length) {
      return { error: graphqlErrorMessage(body.errors) };
    }

    if (!body.data?.deleteAuthUserSecurityKey) {
      return { error: 'That passkey is not on this account.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not remove the passkey: ${errorMessage(err)}` };
  }
}
