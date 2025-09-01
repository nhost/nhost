import { reactive, computed } from "vue";
import { createClient } from "@nhost/nhost-js";
import { type Session } from "@nhost/nhost-js/auth";

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
let isInitialized = false;

// Initialize auth state
const initializeAuth = () => {
  if (isInitialized) return;

  authState.isLoading = true;

  // Set initial values
  const currentSession = nhost.getUserSession();
  authState.user = currentSession?.user || null;
  authState.session = currentSession;
  authState.isLoading = false;

  // Subscribe to session changes
  unsubscribe = nhost.sessionStorage.onChange((currentSession) => {
    authState.user = currentSession?.user || null;
    authState.session = currentSession;
  });

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
