import { createClient, generateServiceUrl } from '@nhost/nhost-js';
import {
  type Client as AuthClient,
  createAPIClient,
  type User,
} from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import type { StoredSession } from '@nhost/nhost-js/session';
import { clearAfterReinstall } from '@/lib/install';
import { nhostRegion, nhostSubdomain } from './env';
import { graphqlErrorMessage } from './graphql';
import { SecureStoreStorage } from './storage';

// Before the client exists: the SDK reads storage lazily, so nothing has seen
// the previous install's session yet.
clearAfterReinstall((refreshToken) => bareAuth().signOut({ refreshToken }));

/** The app's one Nhost client. It keeps the session in SecureStore. */
export const nhost = createClient({
  region: nhostRegion(),
  subdomain: nhostSubdomain(),
  storage: new SecureStoreStorage(),
});

/**
 * An auth client with no session attached. The main client stores the session
 * any `/token` or `/signin/` call answers with, and clears it on `/signout` and
 * on a password change, so calls that must not touch it go through this one.
 */
export function bareAuth(): AuthClient {
  return createAPIClient(
    generateServiceUrl('auth', nhostSubdomain(), nhostRegion()),
  );
}

export type VerifiedUser =
  | { user: User }
  | { user: null; reason: 'signed-out' | 'rejected' | 'unavailable' };

/**
 * The signed-in user as the auth service sees them. `rejected` is a 401: a
 * token the auth service did not issue or no longer accepts. `unavailable`
 * means it could not answer.
 */
export async function getVerifiedUser(): Promise<VerifiedUser> {
  if (!nhost.getUserSession()) {
    return { user: null, reason: 'signed-out' };
  }

  try {
    const { body } = await nhost.auth.getUser();
    // The SDK turns an empty 2xx into `{}`, which is truthy but no user.
    return body?.id ? { user: body } : { user: null, reason: 'unavailable' };
  } catch (err) {
    if ((err as FetchError).status === 401) {
      return { user: null, reason: 'rejected' };
    }
    console.error('Could not verify the session:', err);
    return { user: null, reason: 'unavailable' };
  }
}

/** Rewrites the stored session's user after a profile write has succeeded. */
export function updateSessionUser(patch: Partial<User>): void {
  const session = nhost.getUserSession();

  if (!session?.user) {
    return;
  }

  nhost.sessionStorage.set({
    ...session,
    user: { ...session.user, ...patch },
  });
}

// Auth emails and the OAuth callback redirect back with a one-time `code` and
// the link's `type`, such as `passwordReset`, in the query string.
export const LINK_TYPE_PARAM = 'type';

export type CheckedSession = 'live' | 'revoked' | 'unknown';

/** Whether the session's row in `auth.refresh_tokens` still exists. */
export async function checkSession(
  session: StoredSession,
): Promise<CheckedSession> {
  const id = session.refreshTokenId;

  if (!id) {
    return 'unknown';
  }

  try {
    const { body } = await nhost.graphql.request<{
      authRefreshToken: { id: string } | null;
    }>({
      query: `query Session($id: uuid!) {
        authRefreshToken(id: $id) { id }
      }`,
      variables: { id },
    });

    if (body.errors?.length) {
      console.error(
        'Could not check the session:',
        graphqlErrorMessage(body.errors),
      );
      return 'unknown';
    }

    const row = body.data?.authRefreshToken;
    if (row === null) {
      return 'revoked';
    }
    return row ? 'live' : 'unknown';
  } catch (err) {
    console.error('Could not check the session:', err);
    return 'unknown';
  }
}
