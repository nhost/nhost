import type { Session } from '@nhost/nhost-js/auth';
import { useRouter } from 'next/router';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  clearGitHubToken,
  type GitHubProviderToken,
  saveGitHubToken,
} from '@/features/orgs/projects/git/common/utils';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import { isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost/';
import { useGetAuthUserProvidersLazyQuery } from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { AuthContext, type AuthContextType } from './AuthContext';

const removableParams = [
  'refreshToken',
  'error',
  'errorDescription',
  'state',
  'provider_state',
];

function AuthProvider({ children }: PropsWithChildren) {
  const nhost = useNhostClient();
  const [getAuthUserProviders] = useGetAuthUserProvidersLazyQuery();
  const { query, isReady: isRouterReady, push } = useRouter();
  const {
    refreshToken,
    error,
    errorDescription,
    signinProvider,
    state,
    provider_state: providerState,
  } = query;
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  // biome-ignore lint/correctness/useExhaustiveDependencies: The onChange method does not change
  useEffect(() => {
    const unsubscribe = nhost.sessionStorage.onChange(setSession);
    function storageEventListener(event: StorageEvent) {
      if (event.key === 'nhostSession') {
        const newSession = event.newValue
          ? (JSON.parse(event.newValue) as Session)
          : null;
        setSession(newSession);
      }
    }
    window.addEventListener('storage', storageEventListener);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', storageEventListener);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only need to run on mount
  useEffect(() => {
    async function initializeSession() {
      if (!isRouterReady) {
        return;
      }
      setIsLoading(true);
      setIsSigningOut(false);
      if (refreshToken && typeof refreshToken === 'string') {
        const sessionResponse = await nhost.auth.refreshToken({
          refreshToken,
        });
        setSession(sessionResponse.body);
        removeQueryParamsFromUrl(...removableParams);

        if (sessionResponse.body && signinProvider === 'github') {
          try {
            const providerTokensResponse =
              await nhost.auth.getProviderTokens(signinProvider);
            if (providerTokensResponse.body) {
              const { data } = await getAuthUserProviders();
              const githubProvider = data?.authUserProviders?.find(
                (provider) => provider.providerId === 'github',
              );
              const newGitHubToken: GitHubProviderToken =
                providerTokensResponse.body;
              if (
                isNotEmptyValue(githubProvider) &&
                isNotEmptyValue(githubProvider?.id)
              ) {
                newGitHubToken.authUserProviderId = githubProvider.id;
              }
              saveGitHubToken(newGitHubToken);
            }
          } catch (err) {
            console.error('Failed to fetch provider tokens:', err);
          }
        }

        const postSignInRedirect = sessionStorage.getItem('postSignInRedirect');
        if (postSignInRedirect?.startsWith('/')) {
          sessionStorage.removeItem('postSignInRedirect');
          await push(postSignInRedirect);
        }
      } else {
        const currentSession = nhost.getUserSession();
        setSession(currentSession);
      }

      if (
        state &&
        typeof state === 'string' &&
        state.startsWith('signin-refresh:')
      ) {
        const [, orgSlug, projectSubdomain] = state.split(':');
        removeQueryParamsFromUrl(...removableParams);

        await push(
          `/orgs/${orgSlug}/projects/${projectSubdomain}/settings/git?github-modal`,
        );
      }

      if (typeof error === 'string') {
        switch (error) {
          case 'unverified-user': {
            removeQueryParamsFromUrl(...removableParams);
            await push('/email/verify');
            break;
          }

          /*
           * If the state isn't handled by Hasura auth, it returns `invalid-state`.
           * However, we check the provider_state search param to see if it has this format:
           * `install-github-app:<org-slug>:<project-subdomain>`.
           * If it has this format, that means that we connected to GitHub in `/settings/git`,
           * thus we need to show the connect GitHub modal again.
           * Otherwise, we fall through to default error handling.
           */

          // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional
          case 'invalid-state': {
            if (
              isNotEmptyValue(providerState) &&
              typeof providerState === 'string' &&
              providerState.startsWith('install-github-app:')
            ) {
              const [, orgSlug, projectSubdomain] = providerState.split(':');
              removeQueryParamsFromUrl(...removableParams);
              await push(
                `/orgs/${orgSlug}/projects/${projectSubdomain}/settings/git?github-modal`,
              );
              break;
            }
            // Fall through to default error handling if state search param is invalid
          }
          default: {
            const description =
              typeof errorDescription === 'string'
                ? errorDescription
                : 'An error occurred during the sign-in process. Please try again.';
            toast.error(description, getToastStyleProps());
            removeQueryParamsFromUrl(...removableParams);
            await push('/signin');
          }
        }
      }

      setIsLoading(false);
    }
    initializeSession();
  }, [isRouterReady]);

  const value: AuthContextType = useMemo(
    () => ({
      user: session?.user || null,
      session,
      isAuthenticated: !!session,
      isLoading,
      isSigningOut,
      signout: async () => {
        setSession(null);
        setIsSigningOut(true);
        nhost.auth.signOut({
          refreshToken: session!.refreshToken,
        });
        clearGitHubToken();

        await push('/signin');
      },
      updateSession(newSession) {
        setSession(newSession);
      },
      clearIsSigningOut() {
        setIsSigningOut(false);
      },
    }),
    [session, isLoading, isSigningOut, nhost.auth.signOut, push],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
