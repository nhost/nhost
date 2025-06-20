import { type Session } from '@nhost/nhost-js-beta/auth';
import { createContext } from 'react';

export type AuthContextType = {
  user: Session['user'] | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signout: () => Promise<void>;
  updateSession: (newSession: Session | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  signout: async () => {},
  updateSession: () => {},
});
