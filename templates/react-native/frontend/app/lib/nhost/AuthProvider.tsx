import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { StoredSession } from '@nhost/nhost-js/session';
import Constants from 'expo-constants';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NhostAsyncStorage } from './storage';

interface AuthContextValue {
  nhost: NhostClient;
  session: StoredSession | null;
  user: StoredSession['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const nhost = useMemo(() => {
    const extra = Constants.expoConfig?.extra ?? {};
    return createClient({
      subdomain: (extra['NHOST_SUBDOMAIN'] as string) || 'local',
      region: (extra['NHOST_REGION'] as string) || 'local',
      storage: new NhostAsyncStorage(),
    });
  }, []);

  useEffect(() => {
    // Give AsyncStorage a moment to hydrate the cached session on cold start.
    const timer = setTimeout(() => {
      setSession(nhost.getUserSession());
      setIsLoading(false);
    }, 100);

    const unsubscribe = nhost.sessionStorage.onChange((next) => {
      setSession(next);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [nhost]);

  const value = useMemo<AuthContextValue>(
    () => ({
      nhost,
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      isLoading,
    }),
    [nhost, session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
