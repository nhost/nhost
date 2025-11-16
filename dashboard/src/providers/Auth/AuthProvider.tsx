import {
  clearGitHubToken,
  saveGitHubToken,
  type GitHubProviderToken,
} from '@/features/orgs/projects/git/common/utils';
import { isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost/';
import { useGetAuthUserProvidersLazyQuery } from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { type Session } from '@nhost/nhost-js/auth';
import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { toast } from 'react-hot-toast';
import { AuthContext, type AuthContextType } from './AuthContext';

function AuthProvider({ children }: PropsWithChildren) {
  const nhost = useNhostClient();
  const [getAuthUserProviders] = useGetAuthUserProvidersLazyQuery();
  const {
    query,
    isReady: isRouterReady,
    replace,
    pathname,
    push,
  } = useRouter();
  const {
    refreshToken,
    error,
    errorDescription,
    signinProvider,
    state,
    provider_state: providerState,
    ...remainingQuery
  } = query;
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const removeQueryParamsFromURL = useCallback(() => {
    replace({ pathname, query: remainingQuery }, undefined, {
      shallow: true,
    });
  }, [replace, remainingQuery, pathname]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        removeQueryParamsFromURL();

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
              if (isNotEmptyValue(githubProvider?.id)) {
                newGitHubToken.authUserProviderId = githubProvider!.id;
              }
              saveGitHubToken(newGitHubToken);
            }
          } catch (err) {
            console.error('Failed to fetch provider tokens:', err);
          }
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
        removeQueryParamsFromURL();
        await push(
          `/orgs/${orgSlug}/projects/${projectSubdomain}/settings/git?github-modal`,
        );
      }

      if (typeof error === 'string') {
        switch (error) {
          case 'unverified-user': {
            removeQueryParamsFromURL();
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
          case 'invalid-state': {
            if (
              isNotEmptyValue(providerState) &&
              typeof providerState === 'string' &&
              providerState.startsWith('install-github-app:')
            ) {
              const [, orgSlug, projectSubdomain] = providerState.split(':');
              removeQueryParamsFromURL();
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
            removeQueryParamsFromURL();
            await push('/signin');
          }
        }
      }

      setIsLoading(false);
    }
    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
