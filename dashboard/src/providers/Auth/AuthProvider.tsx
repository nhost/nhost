import { useNhostClient } from '@/providers/nhost/';
import { type Session } from '@nhost/nhost-js-beta/auth';
import { useRouter } from 'next/router';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  const { refreshToken, ...remainingQuery } = query;
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const removeSessionIdFromQuery = useCallback(() => {
    replace({ pathname, query: remainingQuery }, undefined, {
      shallow: true,
    });
  }, [replace, remainingQuery, pathname]);

  useEffect(() => {
    const unsubscribe = nhost.sessionStorage.onChange(setSession);
    function storageEventListener(event: StorageEvent) {
      if (event.key === 'nhostSession') {
        const newSession = JSON.parse(event.newValue) as Session;
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
        removeSessionIdFromQuery();
      } else {
        const currentSession = nhost.getUserSession();
        setSession(currentSession);
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
          refreshToken: session.refreshToken,
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
