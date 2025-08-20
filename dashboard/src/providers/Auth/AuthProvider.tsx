import { useNhostClient } from '@/providers/nhost/';
import { getToastStyleProps } from '@/utils/constants/settings';
import { type Session } from '@nhost/nhost-js-beta/auth';
import { useRouter } from 'next/router';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'react-hot-toast';
import { AuthContext, type AuthContextType } from './AuthContext';

function AuthProvider({ children }: PropsWithChildren) {
  const nhost = useNhostClient();
  const {
    query,
    isReady: isRouterReady,
    replace,
    pathname,
    push,
  } = useRouter();
  const { refreshToken, error, errorDescription, ...remainingQuery } = query;
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
      // reset state if we have just signed out
      setIsSigningOut(false);
      if (refreshToken && typeof refreshToken === 'string') {
        const sessionResponse = await nhost.auth.refreshToken({
          refreshToken,
        });
        setSession(sessionResponse.body);
        removeQueryParamsFromURL();
      } else {
        const currentSession = nhost.getUserSession();
        setSession(currentSession);
      }

      // handle OAuth redirect errors (e.g., error=unverified-user)
      if (typeof error === 'string') {
        if (error === 'unverified-user') {
          removeQueryParamsFromURL();
          await push('/email/verify');
        } else {
          const description =
            typeof errorDescription === 'string'
              ? errorDescription
              : 'An error occurred during the sign-in process. Please try again.';
          toast.error(description, getToastStyleProps());
          removeQueryParamsFromURL();
          await push('/signin');
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
