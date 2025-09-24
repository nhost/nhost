import { createClient } from "@nhost/nhost-js";
import type { Session } from "@nhost/nhost-js/auth";
import { computed, reactive } from "vue";

// Global reactive state
const authState = reactive({
  user: null as Session["user"] | null,
  session: null as Session | null,
  isLoading: true,
});

// Create the nhost client
const nhost = createClient({
  region: (import.meta.env["VITE_NHOST_REGION"] as string) || "local",
  subdomain: (import.meta.env["VITE_NHOST_SUBDOMAIN"] as string) || "local",
});

// Subscription cleanup function
let unsubscribe: (() => void) | null = null;
let lastRefreshTokenIdRef: string | null = null;
let isInitialized = false;

/**
 * Handles session reload when refresh token changes.
 * This detects when the session has been updated from other tabs.
 *
 * @param currentRefreshTokenId - The current refresh token ID to compare against stored value
 */
const reloadSession = (currentRefreshTokenId: string | null) => {
  if (currentRefreshTokenId !== lastRefreshTokenIdRef) {
    lastRefreshTokenIdRef = currentRefreshTokenId;

    // Update local authentication state to match current session
    const currentSession = nhost.getUserSession();
    authState.user = currentSession?.user || null;
    authState.session = currentSession;
  }
};

// Initialize auth state
const initializeAuth = () => {
  if (isInitialized) return;

  authState.isLoading = true;

  // Set initial values
  const currentSession = nhost.getUserSession();
  authState.user = currentSession?.user || null;
  authState.session = currentSession;
  lastRefreshTokenIdRef = currentSession?.refreshTokenId ?? null;
  authState.isLoading = false;

  // Subscribe to session changes from other browser tabs
  // This enables real-time synchronization when user signs in/out in another tab
  unsubscribe = nhost.sessionStorage.onChange((currentSession) => {
    reloadSession(currentSession?.refreshTokenId ?? null);
  });

  // Handle session changes from page focus events (for additional session consistency)
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

  isInitialized = true;
};

// Cleanup function
const cleanup = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  isInitialized = false;
};

/**
 * Vue composable for authentication state and operations.
 *
 * Provides reactive access to current user session, authentication state, and Nhost client.
 * Handles cross-tab session synchronization and automatic state updates.
 *
 * @returns Object containing reactive authentication state and Nhost client
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAuth } from './lib/nhost/auth';
 *
 * const { user, isAuthenticated, nhost } = useAuth();
 * </script>
 *
 * <template>
 *   <div v-if="!isAuthenticated">Please sign in</div>
 *   <div v-else>Welcome, {{ user?.displayName }}!</div>
 * </template>
 * ```
 */
export function useAuth() {
  // Initialize auth if not already done
  if (!isInitialized && typeof window !== "undefined") {
    initializeAuth();
  }

  return {
    user: computed(() => authState.user),
    session: computed(() => authState.session),
    isLoading: computed(() => authState.isLoading),
    isAuthenticated: computed(() => !!authState.session),
    nhost,
  };
}

// Initialize auth immediately (for SSR compatibility)
if (typeof window !== "undefined") {
  initializeAuth();
}

// Cleanup on window unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanup);
}
