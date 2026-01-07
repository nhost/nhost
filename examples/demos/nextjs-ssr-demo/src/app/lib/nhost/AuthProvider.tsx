'use client';

import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import { CookieStorage } from '@nhost/nhost-js/session';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Authentication context interface providing access to user session state and Nhost client.
 * Used throughout the application to access authentication-related data and operations.
 */
interface AuthContextType {
  /** Current authenticated user object, null if not authenticated */
  user: Session['user'] | null;
  /** Current session object containing tokens and user data, null if no active session */
  session: Session | null;
  /** Boolean indicating if user is currently authenticated */
  isAuthenticated: boolean;
  /** Boolean indicating if authentication state is still loading */
  isLoading: boolean;
  /** Nhost client instance for making authenticated requests */
  nhost: NhostClient;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component that provides authentication context to the Next.js application.
 *
 * This component handles:
 * - Initializing the Nhost client with cookie-based session storage
 * - Managing authentication state (user, session, loading, authenticated status)
 * - Cross-tab session synchronization using sessionStorage.onChange events
 * - Detecting middleware-driven session changes through refresh token monitoring
 * - Page visibility and focus event handling to maintain session consistency
 * - Server-side state synchronization via router.refresh() when sessions change
 *
 * Key features:
 * - Uses CookieStorage for session persistence across server/client boundaries
 * - Tracks refresh token changes to detect server-side session updates
 * - Automatically refreshes page when session state changes from other sources
 * - Provides reactive authentication state for client components
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const lastRefreshTokenIdRef = useRef<string | null>(null);
  const router = useRouter();

  // Initialize Nhost client with cookie-based storage for server/client session sharing
  const nhost = useMemo(
    () =>
      createClient({
        region: process.env['NHOST_REGION'] || 'local',
        subdomain: process.env['NHOST_SUBDOMAIN'] || 'local',
        storage: new CookieStorage({
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        }),
      }),
    [],
  );

  /**
   * Handles session reload when refresh token changes.
   * This detects when the session has been updated by middleware or other tabs.
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

        // Trigger Next.js page refresh to sync server-side state with client changes
        router.refresh();
      }
    },
    [nhost, router],
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

  // Handle session changes from server-side middleware and page focus events
  useEffect(() => {
    /**
     * Checks for session changes when page becomes visible or focused.
     * This catches middleware-driven session updates that occur server-side.
     */
    const checkSessionOnFocus = () => {
      reloadSession(nhost.getUserSession()?.refreshTokenId ?? null);
    };

    // Monitor page visibility changes (tab switching, window minimizing)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkSessionOnFocus();
      }
    });

    // Monitor window focus events (clicking back into the browser window)
    window.addEventListener('focus', checkSessionOnFocus);

    // Cleanup event listeners on component unmount
    return () => {
      document.removeEventListener('visibilitychange', checkSessionOnFocus);
      window.removeEventListener('focus', checkSessionOnFocus);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
