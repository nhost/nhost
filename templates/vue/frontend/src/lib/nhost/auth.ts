import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { StoredSession } from '@nhost/nhost-js/session';
import { computed, reactive } from 'vue';

// The browser SDK persists the session in localStorage by default and syncs it
// across tabs through sessionStorage.onChange.
const nhost: NhostClient = createClient({
  subdomain: (import.meta.env['VITE_NHOST_SUBDOMAIN'] as string) || 'local',
  region: (import.meta.env['VITE_NHOST_REGION'] as string) || 'local',
});

const state = reactive({
  session: null as StoredSession | null,
  isLoading: true,
});

let initialized = false;

function initialize(): void {
  if (initialized || typeof window === 'undefined') {
    return;
  }
  initialized = true;

  state.session = nhost.getUserSession();
  state.isLoading = false;

  nhost.sessionStorage.onChange((next) => {
    state.session = next;
  });
}

initialize();

/**
 * Reactive access to the Nhost client and the current session.
 */
export function useAuth() {
  initialize();

  return {
    nhost,
    session: computed(() => state.session),
    user: computed(() => state.session?.user ?? null),
    isAuthenticated: computed(() => !!state.session),
    isLoading: computed(() => state.isLoading),
  };
}
