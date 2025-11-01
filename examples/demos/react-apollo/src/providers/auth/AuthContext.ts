import { type Session } from "@nhost/nhost-js/auth";
import { createContext } from "react";

export type AuthContextType = {
  user: NonNullable<Session["user"]> | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signout: () => Promise<void>;
  isSigningOut: boolean;
  updateSession: (newSession: Session | null) => void;
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
