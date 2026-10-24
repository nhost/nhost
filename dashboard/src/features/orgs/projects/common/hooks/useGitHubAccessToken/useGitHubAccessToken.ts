import { type ApolloClient, useApolloClient } from '@apollo/client';
import type { NhostClient } from '@nhost/nhost-js';
import type { ProviderSession } from '@nhost/nhost-js/auth';
import { useEffect, useRef, useState } from 'react';
import {
  getGitHubToken,
  saveGitHubToken,
} from '@/features/orgs/projects/git/common/utils';
import {
  GetAuthUserProvidersDocument,
  type GetAuthUserProvidersQuery,
  useGetAuthUserProvidersQuery,
} from '@/generated/graphql';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';
import { nhost } from '@/utils/nhost';

type TokenResult =
  | {
      status: 'loading' | 'connection-required' | 'expired';
      accessToken?: never;
    }
  | { status: 'ready'; accessToken: string }
  | {
      status: 'error';
      accessToken?: never;
      error: Error;
      source: 'provider-query' | 'token';
    };

interface Refresh {
  promise: Promise<ProviderSession | null>;
  invalidated: boolean;
}

const refreshes = new Map<string, Refresh>();

function refreshToken(
  identity: string,
  token: string,
  sessionClient: NhostClient,
  userId: string,
  apolloClient: ApolloClient<object>,
  providerId: string,
) {
  const pending = refreshes.get(identity);
  if (pending) {
    return pending;
  }

  const refresh: Refresh = {
    invalidated: false,
    promise: nhost.auth
      .refreshProviderToken('github', { refreshToken: token })
      .then(async (response) => {
        if (!response.body || refresh.invalidated) {
          return null;
        }
        // The last consumer may have closed before an account-settings provider change.
        const { data } = await apolloClient.query<GetAuthUserProvidersQuery>({
          query: GetAuthUserProvidersDocument,
          fetchPolicy: 'network-only',
        });
        if (
          !data.authUserProviders.some(
            (provider) =>
              provider.providerId === 'github' && provider.id === providerId,
          )
        ) {
          refresh.invalidated = true;
        }
        return response.body;
      })
      .finally(() => {
        unsubscribe();
        refreshes.delete(identity);
      }),
  };
  // Observe authentication through refresh and provider validation, even without mounted consumers.
  const unsubscribe = sessionClient.sessionStorage.onChange((session) => {
    if (session?.user?.id !== userId) {
      refresh.invalidated = true;
    }
  });
  refreshes.set(identity, refresh);
  return refresh;
}

export default function useGitHubAccessToken(): TokenResult {
  const { user, isAuthenticated, isLoading: loadingAuth } = useAuth();
  const sessionClient = useNhostClient();
  const apolloClient = useApolloClient();
  const userId = isAuthenticated ? user?.id : undefined;
  const { data, loading, error } = useGetAuthUserProvidersQuery({
    skip: loadingAuth || !isAuthenticated,
  });
  const providerId = data?.authUserProviders?.find(
    (provider) => provider.providerId === 'github',
  )?.id;
  const identity = userId && providerId ? `${userId}:${providerId}` : null;
  const [result, setResult] = useState<{
    identity: string | null;
    token: TokenResult;
  }>({ identity: null, token: { status: 'loading' } });

  const previousIdentity = useRef(identity);

  useEffect(() => {
    let active = true;
    if (previousIdentity.current && previousIdentity.current !== identity) {
      const pending = refreshes.get(previousIdentity.current);
      if (pending) {
        pending.invalidated = true;
      }
    }
    previousIdentity.current = identity;
    if (!identity) {
      setResult({ identity: null, token: { status: 'loading' } });
    }
    if (loadingAuth || loading || error || !userId || !providerId) {
      return;
    }

    async function readToken(
      currentIdentity: string,
      currentProviderId: string,
      currentUserId: string,
    ) {
      setResult({ identity, token: { status: 'loading' } });
      try {
        const stored = getGitHubToken();
        if (
          !stored?.authUserProviderId ||
          stored.authUserProviderId !== currentProviderId
        ) {
          setResult({ identity, token: { status: 'expired' } });
          return;
        }

        if (!(new Date(stored.expiresAt).getTime() - Date.now() < 60_000)) {
          setResult({
            identity,
            token: { status: 'ready', accessToken: stored.accessToken },
          });
          return;
        }
        if (!stored.refreshToken) {
          setResult({ identity, token: { status: 'expired' } });
          return;
        }

        const refresh = refreshToken(
          currentIdentity,
          stored.refreshToken,
          sessionClient,
          currentUserId,
          apolloClient,
          currentProviderId,
        );
        const refreshed = await refresh.promise;
        const current = getGitHubToken();
        if (
          !refreshed ||
          refresh.invalidated ||
          sessionClient.getUserSession()?.user?.id !== currentUserId ||
          !current ||
          current.authUserProviderId !== currentProviderId ||
          (current.refreshToken !== stored.refreshToken &&
            current.accessToken !== refreshed?.accessToken)
        ) {
          if (active) {
            setResult({ identity, token: { status: 'expired' } });
          }
          return;
        }

        // Keep the single-use rotation if the consumer closed, but never after an identity or storage change.
        saveGitHubToken({
          ...refreshed,
          authUserProviderId: currentProviderId,
        });
        if (active) {
          setResult({
            identity,
            token: { status: 'ready', accessToken: refreshed.accessToken },
          });
        }
      } catch (cause) {
        if (active) {
          setResult({
            identity,
            token: {
              status: 'error',
              source: 'token',
              error:
                cause instanceof Error
                  ? cause
                  : new Error('An error occurred while fetching GitHub data.'),
            },
          });
        }
      }
    }
    readToken(`${userId}:${providerId}`, providerId, userId);
    return () => {
      active = false;
    };
  }, [
    identity,
    providerId,
    userId,
    sessionClient,
    apolloClient,
    loadingAuth,
    loading,
    error,
  ]);

  if (loadingAuth || loading) {
    return { status: 'loading' };
  }
  if (error) {
    return { status: 'error', source: 'provider-query', error };
  }
  if (!identity) {
    return { status: 'connection-required' };
  }
  return result.identity === identity ? result.token : { status: 'loading' };
}
