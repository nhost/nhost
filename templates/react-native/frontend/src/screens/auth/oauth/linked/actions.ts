import type { SignInProvider } from '@nhost/nhost-js/auth';
import { openAuthSessionAsync } from 'expo-web-browser';
import { getVerifiedUser, nhost } from '@/lib/nhost/client';
import { appUrl } from '@/lib/nhost/env';
import {
  type ActionResult,
  errorMessage,
  SIGNED_OUT,
} from '@/lib/nhost/errors';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';
import { FLOW_PARAM, openLink, parseLink } from '@/lib/nhost/links';
import { randomToken } from '@/lib/nhost/pkce';
import { BROWSER_ERROR, RETURN_URL } from '@/screens/auth/oauth/actions';
import { leavesAWayIn } from '@/screens/auth/oauth/linked/wayIn';
import {
  ACCOUNT_PICKER,
  inAppBrowserURL,
} from '@/screens/auth/oauth/providers';

export type LinkedAccount = {
  id: string;
  providerId: string;
  createdAt: string;
};

const ACCOUNT_PATH = '/account';

/**
 * Adds `id` to the signed-in account in the in-app browser: the same trip as
 * signing in, with the session's access token as `connect`. Auth comes back to
 * `redirectTo` as it was, or with an error, never with a code, so the trip
 * needs no stored flow and no challenge. Closing the browser does nothing.
 */
export async function linkProvider(id: SignInProvider): Promise<ActionResult> {
  try {
    // Refreshed first, so the token auth reads has not expired.
    const session = await nhost.refreshSession(60);
    if (!session) {
      return { error: SIGNED_OUT };
    }

    const result = await openAuthSessionAsync(
      inAppBrowserURL(
        nhost.auth.signInProviderURL(id, {
          connect: session.accessToken,
          // An id of its own all the same, which the app strips like any
          // flow's: links are handled once per id, so a second trip that fails
          // the same way would otherwise show nothing.
          redirectTo: appUrl(ACCOUNT_PATH, { [FLOW_PARAM]: randomToken(16) }),
          upstreamParams: ACCOUNT_PICKER,
        }),
      ),
      RETURN_URL,
    );
    if (result.type !== 'success') {
      return {};
    }

    // Shown as any link's error is, on the account screen it came back to.
    if (parseLink(result.url)?.params.some(([key]) => key === 'error')) {
      await openLink(result.url);
      return {};
    }
    return { success: true };
  } catch (err) {
    console.error('Could not link the provider:', err);
    return { error: BROWSER_ERROR };
  }
}

// Listing and unlinking go through GraphQL and the permissions on
// `auth.user_providers` in nhost/metadata, which leave out the provider's
// tokens.
export async function listLinkedAccounts(): Promise<
  ActionResult & { links?: LinkedAccount[] }
> {
  try {
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
// caller cannot talk its way past `leavesAWayIn`.
export async function unlinkProvider(id: string): Promise<ActionResult> {
  if (!id) {
    return { error: 'Which account?' };
  }

  try {
    const { user } = await getVerifiedUser();

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
