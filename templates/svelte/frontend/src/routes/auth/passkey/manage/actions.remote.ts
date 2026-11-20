import type {
  CredentialCreationResponse,
  PublicKeyCredentialCreationOptions,
} from '@nhost/nhost-js/auth';
import * as v from 'valibot';
import {
  type ActionResult,
  errorMessage,
  RETRY_IN,
  SIGNED_OUT,
} from '#lib/nhost/errors.ts';
import { graphqlErrorMessage } from '#lib/nhost/graphql.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { command, query } from '$app/server';

export type Passkey = {
  id: string;
  credentialId: string;
  nickname: string | null;
};

// Listing and removing go through GraphQL, not the auth API, and depend on
// the permissions in nhost/metadata.
export const listPasskeys = query(
  async (): Promise<ActionResult & { keys?: Passkey[] }> => {
    try {
      const nhost = createNhostClient();

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
  },
);

// Adding is the same two-step ceremony as sign-up, against the signed-in
// account: the backend issues a challenge, the authenticator signs it, the
// backend keeps the public key.
export const beginAddPasskey = command(
  async (): Promise<
    ActionResult & { options?: PublicKeyCredentialCreationOptions }
  > => {
    try {
      const nhost = createNhostClient();

      if (!nhost.getUserSession()) {
        return { error: SIGNED_OUT };
      }

      const { body } = await nhost.auth.addSecurityKey();

      return { options: body };
    } catch (err) {
      return {
        error: `Could not start adding a passkey: ${errorMessage(err)}`,
      };
    }
  },
);

export const finishAddPasskey = command(
  v.object({
    // The browser's answer, which auth checks. Here it only has to be an
    // object.
    credential: v.custom<CredentialCreationResponse>(
      (value) => typeof value === 'object' && value !== null,
    ),
    nickname: v.string(),
  }),
  async ({ credential, nickname }): Promise<ActionResult> => {
    try {
      const nhost = createNhostClient();

      if (!nhost.getUserSession()) {
        return { error: SIGNED_OUT };
      }

      await nhost.auth.verifyAddSecurityKey({
        credential,
        nickname: nickname.trim() || undefined,
      });

      return { success: true };
    } catch (err) {
      return {
        error: `Could not add the passkey: ${errorMessage(err, RETRY_IN.signIn)}`,
      };
    }
  },
);

// The permission filters by the signed-in user, so an id belonging to someone
// else deletes nothing rather than failing loudly.
export const removePasskey = command(
  v.string(),
  async (id): Promise<ActionResult> => {
    if (!id) {
      return { error: 'Which passkey?' };
    }

    try {
      const nhost = createNhostClient();

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
  },
);
