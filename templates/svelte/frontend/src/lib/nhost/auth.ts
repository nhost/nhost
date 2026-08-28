import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { StoredSession } from '@nhost/nhost-js/session';
import { derived, writable } from 'svelte/store';
import { browser } from '$app/environment';

// The browser SDK persists the session in localStorage by default and syncs it
// across tabs through sessionStorage.onChange.
export const nhost: NhostClient = createClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || 'local',
  region: import.meta.env.VITE_NHOST_REGION || 'local',
});

export const session = writable<StoredSession | null>(null);
export const user = derived(session, ($session) => $session?.user ?? null);
export const isAuthenticated = derived(session, ($session) => !!$session);

let initialized = false;

/**
 * Loads the current session and subscribes to cross-tab session changes.
 * Call once from the root layout; it is a no-op on the server and after the
 * first call.
 */
export function initializeAuth(): void {
  if (!browser || initialized) {
    return;
  }
  initialized = true;

  session.set(nhost.getUserSession());
  nhost.sessionStorage.onChange((next) => {
    session.set(next);
  });
}
