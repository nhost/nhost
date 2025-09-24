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

/**
 * Authentication context interface providing access to user session state and Nhost client.
 * Used throughout the React Native application to access authentication-related data and operations.
 */
interface AuthContextType {
  /** Current authenticated user object, null if not authenticated */
  user: Session["user"] | null;
  /** Current session object containing tokens and user data, null if no active session */
  session: Session | null;
  /** Boolean indicating if user is currently authenticated */
  isAuthenticated: boolean;
  /** Boolean indicating if authentication state is still loading */
  isLoading: boolean;
  /** Nhost client instance for making authenticated requests */
  nhost: NhostClient;
}

// Create React context for authentication state and nhost client
const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component that provides authentication context to the React Native application.
 *
 * This component handles:
 * - Initializing the Nhost client with AsyncStorage for persistent storage
 * - Managing authentication state (user, session, loading, authenticated status)
 * - Cross-device session synchronization using sessionStorage.onChange events
 * - Async session initialization to work with React Native's AsyncStorage
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Create the nhost client with persistent storage
  const nhost = useMemo(() => {
    // Get configuration values with type assertion
    const subdomain =
      (Constants.expoConfig?.extra?.["NHOST_SUBDOMAIN"] as string) || "local";
    const region =
      (Constants.expoConfig?.extra?.["NHOST_REGION"] as string) || "local";

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

/**
 * Custom hook to access the authentication context.
 *
 * Must be used within a component wrapped by AuthProvider.
 * Provides access to current user session, authentication state, and Nhost client.
 *
 * @throws {Error} When used outside of AuthProvider
 * @returns {AuthContextType} Authentication context containing user, session, and client
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, nhost } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <Text>Please sign in</Text>;
 *   }
 *
 *   return <Text>Welcome, {user?.displayName}!</Text>;
 * }
 * ```
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;
