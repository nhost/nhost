import { createClient, type NhostClient } from "@nhost/nhost-js";
import { writable, derived, type Readable } from "svelte/store";
import type { Session } from "@nhost/nhost-js/auth";
import { browser } from "$app/environment";

/**
 * Authentication store interface providing access to user session state and Nhost client.
 * Used throughout the SvelteKit application to access authentication-related data and operations.
 */
interface AuthStore {
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

// Initialize Nhost client with default SessionStorage (local storage)
export const nhost = createClient({
  region: import.meta.env.VITE_NHOST_REGION || "local",
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || "local",
});

// Create writable stores for authentication state
const userStore = writable<Session["user"] | null>(null);
const sessionStore = writable<Session | null>(null);
const isLoadingStore = writable<boolean>(true);

// Derived store for authentication status
export const isAuthenticated = derived(sessionStore, ($session) => !!$session);

// Combined auth store
export const auth: Readable<AuthStore> = derived(
  [userStore, sessionStore, isLoadingStore, isAuthenticated],
  ([$user, $session, $isLoading, $isAuthenticated]) => ({
    user: $user,
    session: $session,
    isAuthenticated: $isAuthenticated,
    isLoading: $isLoading,
    nhost,
  }),
);

// Individual store exports for convenience
export const user = userStore;
export const session = sessionStore;
export const isLoading = isLoadingStore;

let lastRefreshTokenId: string | null = null;

/**
 * Handles session reload when refresh token changes.
 * This detects when the session has been updated from other tabs.
 *
 * @param currentRefreshTokenId - The current refresh token ID to compare against stored value
 */
function reloadSession(currentRefreshTokenId: string | null) {
  if (currentRefreshTokenId !== lastRefreshTokenId) {
    lastRefreshTokenId = currentRefreshTokenId;

    // Update local authentication state to match current session
    const currentSession = nhost.getUserSession();
    userStore.set(currentSession?.user || null);
    sessionStore.set(currentSession);
  }
}

/**
 * Initialize authentication state and set up cross-tab session synchronization.
 * This function should be called once when the application starts (browser only).
 */
export function initializeAuth() {
  if (!browser) return;

  isLoadingStore.set(true);

  // Load initial session state from Nhost client
  const currentSession = nhost.getUserSession();
  userStore.set(currentSession?.user || null);
  sessionStore.set(currentSession);
  lastRefreshTokenId = currentSession?.refreshTokenId ?? null;
  isLoadingStore.set(false);

  // Subscribe to session changes from other browser tabs
  // This enables real-time synchronization when user signs in/out in another tab
  const unsubscribe = nhost.sessionStorage.onChange((session) => {
    reloadSession(session?.refreshTokenId ?? null);
  });

  /**
   * Checks for session changes when page becomes visible or focused.
   * Provides additional consistency checks for session state.
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

  // Return cleanup function
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", checkSessionOnFocus);
    window.removeEventListener("focus", checkSessionOnFocus);
  };
}
