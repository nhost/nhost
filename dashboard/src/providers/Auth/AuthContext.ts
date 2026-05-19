import type { StoredSession } from '@nhost/nhost-js/session';
import { createContext } from 'react';

export type AuthContextType = {
  user: NonNullable<StoredSession['user']> | null;
  session: StoredSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signout: () => Promise<void>;
  isSigningOut: boolean;
  updateSession: (newSession: StoredSession | null) => void;
  clearIsSigningOut: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  isSigningOut: false,
  signout: async () => {},
  updateSession: () => {},
  clearIsSigningOut: () => {},
});
