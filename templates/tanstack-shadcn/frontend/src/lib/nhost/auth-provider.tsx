import type { StoredSession } from '@nhost/nhost-js/session';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { nhost } from '@/lib/nhost/client';

interface AuthState {
  session: StoredSession | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // The session is read after mount so the prerendered shell and the first
  // client render agree, and so the app never touches storage on the server.
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(nhost.getUserSession());
    setIsLoading(false);

    return nhost.sessionStorage.onChange(setSession);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);

  if (!state) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return state;
}
