import type { ClientInit } from '@sveltejs/kit';
import { startAuth } from '$lib/nhost/auth.svelte';

// Awaited before the router reads the URL or renders the first page, so the
// first render already knows whether there is a session. It has to be here
// rather than in a layout's load: SvelteKit takes the address it starts on
// before any load runs and writes it back once they finish, which would put a
// stripped link token straight back on the URL.
//
// A rejection here stops the app from starting at all, so `startAuth` must
// not throw.
export const init: ClientInit = async () => {
  await startAuth();
};
