# SvelteKit

Source: the SvelteKit tutorial, parts 2 and 4 (client-side session, Svelte 5 runes + `svelte/store`).
- https://docs.nhost.io/getting-started/tutorials/svelte/2-protected-routes
- https://docs.nhost.io/getting-started/tutorials/svelte/4-graphql-operations
- Minimal version: https://docs.nhost.io/getting-started/quickstart/sveltekit (note: it scaffolds plain Svelte with Vite, not SvelteKit, but the client code is the same)
- Full code: `examples/tutorials/nhost-svelte-tutorial` in the nhost/nhost repo

## Install and env

```bash
npx sv create --template minimal --types ts --no-add-ons --no-install nhost-svelte-tutorial   # new app only
npm install @nhost/nhost-js
```

`.env`:

```bash
VITE_NHOST_REGION=<region>
VITE_NHOST_SUBDOMAIN=<subdomain>
```

Local project: `local` / `local`, or unset (the code falls back to `"local"`).

## Auth store (`src/lib/nhost/auth.ts`)

Compact version of the tutorial:

```ts
import { createClient, type NhostClient } from "@nhost/nhost-js";
import type { StoredSession } from "@nhost/nhost-js/session";
import { derived, type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";

export const nhost = createClient({
  region: import.meta.env.VITE_NHOST_REGION || "local",
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || "local",
});

const sessionStore = writable<StoredSession | null>(null);
const isLoadingStore = writable(true);

export const auth: Readable<{
  user: StoredSession["user"] | null;
  session: StoredSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  nhost: NhostClient;
}> = derived([sessionStore, isLoadingStore], ([$session, $isLoading]) => ({
  user: $session?.user || null,
  session: $session,
  isAuthenticated: !!$session,
  isLoading: $isLoading,
  nhost,
}));

export function initializeAuth() {
  if (!browser) return;
  sessionStore.set(nhost.getUserSession());
  isLoadingStore.set(false);
  const unsubscribe = nhost.sessionStorage.onChange((s) => sessionStore.set(s));
  return () => unsubscribe();
}
```

The full tutorial exports separate `user` / `session` / `isLoading` / `isAuthenticated` stores and adds cross-tab sync (compare `refreshTokenId`, re-read on `visibilitychange` / `focus`).

Initialize once in `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
import { onMount } from "svelte";
import { auth, initializeAuth } from "$lib/nhost/auth";
let { children } = $props();
onMount(() => initializeAuth());
</script>

{#if $auth.isAuthenticated}<a href="/profile">Profile</a>{/if}
{@render children?.()}
```

## Protected pages

The tutorial protects pages on the client with a redirect in each page:

```svelte
<script lang="ts">
import { goto } from "$app/navigation";
import { auth } from "$lib/nhost/auth";
$effect(() => {
  if (!$auth.isLoading && !$auth.isAuthenticated) void goto("/");
});
</script>

{#if $auth.isLoading}Loading...{:else if $auth.isAuthenticated}...{/if}
```

The docs do not show server-side (`hooks.server.ts` / `+page.server.ts`) session handling for SvelteKit. The session lives in `localStorage`, so server load functions cannot see it. If the user needs SSR auth, say this is not covered by the Nhost docs and ask how to proceed.

## GraphQL

```ts
const response = await $auth.nhost.graphql.request<{ todos: Todo[] }>({
  query: `query GetTodos { todos(order_by: { created_at: desc }) { id title completed } }`,
});
todos = response.body.data?.todos || [];
```

Wrap in `try/catch` (errors throw `FetchError`). Sign out: `await nhost.auth.signOut({ refreshToken: session.refreshToken })`. Sign-in / sign-up: `auth` skill, or https://docs.nhost.io/getting-started/tutorials/svelte/3-user-authentication
