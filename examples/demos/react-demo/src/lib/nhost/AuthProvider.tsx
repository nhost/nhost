import { createClient, type NhostClient } from "@nhost/nhost-js";
import type { Session } from "@nhost/nhost-js/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Authentication context interface providing access to user session state and Nhost client.
 * Used throughout the React application to access authentication-related data and operations.
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
 * AuthProvider component that provides authentication context to the React application.
 *
 * This component handles:
 * - Initializing the Nhost client with default EventEmitterStorage
 * - Managing authentication state (user, session, loading, authenticated status)
 * - Cross-tab session synchronization using sessionStorage.onChange events
 * - Page visibility and focus event handling to maintain session consistency
 * - Client-side only session management (no server-side rendering)
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const lastRefreshTokenIdRef = useRef<string | null>(null);

  // Initialize Nhost client with default SessionStorage (local storage)
  const nhost = useMemo(
    () =>
      createClient({
        region: import.meta.env.VITE_NHOST_REGION || "local",
        subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || "local",
      }),
    [],
  );

  /**
   * Handles session reload when refresh token changes.
   * This detects when the session has been updated from other tabs.
   * Unlike the Next.js version, this only updates local state without server synchronization.
   *
   * @param currentRefreshTokenId - The current refresh token ID to compare against stored value
   */
  const reloadSession = useCallback(
    (currentRefreshTokenId: string | null) => {
      if (currentRefreshTokenId !== lastRefreshTokenIdRef.current) {
        lastRefreshTokenIdRef.current = currentRefreshTokenId;

        // Update local authentication state to match current session
        const currentSession = nhost.getUserSession();
        setUser(currentSession?.user || null);
        setSession(currentSession);
        setIsAuthenticated(!!currentSession);
      }
    },
    [nhost],
  );

  // Initialize authentication state and set up cross-tab session synchronization
  useEffect(() => {
    setIsLoading(true);

    // Load initial session state from Nhost client
    const currentSession = nhost.getUserSession();
    setUser(currentSession?.user || null);
    setSession(currentSession);
    setIsAuthenticated(!!currentSession);
    lastRefreshTokenIdRef.current = currentSession?.refreshTokenId ?? null;
    setIsLoading(false);

    // Subscribe to session changes from other browser tabs
    // This enables real-time synchronization when user signs in/out in another tab
    const unsubscribe = nhost.sessionStorage.onChange((session) => {
      reloadSession(session?.refreshTokenId ?? null);
    });

    return unsubscribe;
  }, [nhost, reloadSession]);

  // Handle session changes from page focus events (for additional session consistency)
  useEffect(() => {
    /**
     * Checks for session changes when page becomes visible or focused.
     * In the React SPA context, this provides additional consistency checks
     * though it's less critical than in the Next.js SSR version.
     */
    const checkSessionOnFocus = () => {
      reloadSession(nhost.getUserSession()?.refreshTokenId ?? null);
    };

    // Monitor page visibility changes (tab switching, window minimizing)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        checkSessionOnFocus();
      }
    });

    // Monitor window focus events (clicking back into the browser window)
    window.addEventListener("focus", checkSessionOnFocus);

    // Cleanup event listeners on component unmount
    return () => {
      document.removeEventListener("visibilitychange", checkSessionOnFocus);
      window.removeEventListener("focus", checkSessionOnFocus);
    };
  }, [nhost, reloadSession]);

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
 *     return <div>Please sign in</div>;
 *   }
 *
 *   return <div>Welcome, {user?.displayName}!</div>;
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
