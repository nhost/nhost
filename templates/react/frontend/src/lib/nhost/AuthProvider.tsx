import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { StoredSession } from '@nhost/nhost-js/session';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

  // The browser SDK persists the session in localStorage by default and syncs
  // it across tabs through sessionStorage.onChange.
  const nhost = useMemo(
    () =>
      createClient({
        subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || 'local',
        region: import.meta.env.VITE_NHOST_REGION || 'local',
      }),
    [],
  );

  useEffect(() => {
    setSession(nhost.getUserSession());
    setIsLoading(false);
    return nhost.sessionStorage.onChange((next) => setSession(next));
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
