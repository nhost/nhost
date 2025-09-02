import { createClient, type NhostClient } from "@nhost/nhost-js";
import type { Session } from "@nhost/nhost-js/session";
import Constants from "expo-constants";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import NhostAsyncStorage from "./AsyncStorage";

interface AuthContextType {
  user: Session["user"] | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  nhost: NhostClient;
}

// Create context for authentication state and nhost client
const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Create the nhost client with persistent storage
  const nhost = useMemo(() => {
    // Get configuration values with type assertion
    const subdomain =
      (Constants.expoConfig?.extra?.NHOST_SUBDOMAIN as string) ||
      "192-168-1-103";
    const region =
      (Constants.expoConfig?.extra?.NHOST_REGION as string) || "local";

    return createClient({
      subdomain,
      region,
      storage: new NhostAsyncStorage(),
    });
  }, []);

  useEffect(() => {
    // Initialize authentication state
    setIsLoading(true);

    // Allow enough time for AsyncStorage to be read and session to be restored
    const initializeSession = async () => {
      try {
        // Let's wait a bit to ensure AsyncStorage has been read
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Now try to get the current session
        const currentSession = nhost.getUserSession();

        setUser(currentSession?.user || null);
        setSession(currentSession);
        setIsAuthenticated(!!currentSession);
      } catch (error) {
        console.warn("Error initializing session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeSession();

    // Listen for session changes
    const unsubscribe = nhost.sessionStorage.onChange((currentSession) => {
      setUser(currentSession?.user || null);
      setSession(currentSession);
      setIsAuthenticated(!!currentSession);
    });

    // Clean up subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [nhost]);

  // Context value with nhost client directly exposed
  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    nhost,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;
