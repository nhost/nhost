import { startAuth } from '$lib/nhost/auth.svelte';

// A single-page app: no server rendering and nothing prerendered, so every
// path is served the same index.html and the router takes over in the browser.
export const ssr = false;
export const prerender = false;

// Awaited before the first page renders, so it already knows whether there is
// a session. SvelteKit runs a layout's load before the layout and page it
// wraps, which is what makes this the right place for it.
export async function load(): Promise<void> {
  await startAuth();
}
