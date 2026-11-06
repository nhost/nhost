# Vue 3 (Vite + Vue Router)

Source: the Vue tutorial, parts 2 and 4.
- https://docs.nhost.io/getting-started/tutorials/vue/2-protected-routes
- https://docs.nhost.io/getting-started/tutorials/vue/4-graphql-operations
- Minimal version: https://docs.nhost.io/getting-started/quickstart/vue
- Full code: `examples/tutorials/nhost-vue-tutorial` in the nhost/nhost repo

## Install and env

```bash
npm create vue@latest nhost-vue-tutorial -- --typescript --router   # new app only
npm install @nhost/nhost-js
```

`.env`:

```bash
VITE_NHOST_REGION=<region>
VITE_NHOST_SUBDOMAIN=<subdomain>
```

Local project: `local` / `local`, or unset (the code falls back to `"local"`).

## Auth composable (`src/lib/nhost/auth.ts`)

A module-level client and reactive state, shared by every component. Compact version of the tutorial:

```ts
import { createClient } from "@nhost/nhost-js";
import type { StoredSession } from "@nhost/nhost-js/session";
import { computed, reactive } from "vue";

const authState = reactive({
  user: null as StoredSession["user"] | null,
  session: null as StoredSession | null,
  isLoading: true,
});

const nhost = createClient({
  region: (import.meta.env["VITE_NHOST_REGION"] as string) || "local",
  subdomain: (import.meta.env["VITE_NHOST_SUBDOMAIN"] as string) || "local",
});

let isInitialized = false;

const initializeAuth = () => {
  if (isInitialized) return;
  const current = nhost.getUserSession();
  authState.user = current?.user || null;
  authState.session = current;
  authState.isLoading = false;
  nhost.sessionStorage.onChange((s) => {
    authState.user = s?.user || null;
    authState.session = s;
  });
  isInitialized = true;
};

export function useAuth() {
  if (!isInitialized && typeof window !== "undefined") initializeAuth();
  return {
    user: computed(() => authState.user),
    session: computed(() => authState.session),
    isLoading: computed(() => authState.isLoading),
    isAuthenticated: computed(() => !!authState.session),
    nhost,
  };
}
```

The full tutorial version also compares `refreshTokenId` and re-reads the session on `visibilitychange` / `focus` for cross-tab sync, and unsubscribes on `beforeunload`.

## Protected routes (`src/router/index.ts`)

Mark routes with `meta: { requiresAuth: true }` and add a guard:

```ts
router.beforeEach((to) => {
  if (to.meta["requiresAuth"]) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading.value) return true; // let the component show a loading state
    if (!isAuthenticated.value) return "/";
  }
  return true;
});
```

UI-level only; data is protected by GraphQL permissions (`database` skill).

## GraphQL in a component

```vue
<script setup lang="ts">
import { useAuth } from "../lib/nhost/auth";
const { nhost } = useAuth();

const fetchTodos = async () => {
  try {
    const response = await nhost.graphql.request<{ todos: Todo[] }>({
      query: `query GetTodos { todos(order_by: { created_at: desc }) { id title completed } }`,
    });
    todos.value = response.body.data?.todos || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to fetch todos";
  }
};
</script>
```

Sign out: `await nhost.auth.signOut({ refreshToken: session.value.refreshToken })` when a session exists. Sign-in / sign-up: `auth` skill, or https://docs.nhost.io/getting-started/tutorials/vue/3-user-authentication
