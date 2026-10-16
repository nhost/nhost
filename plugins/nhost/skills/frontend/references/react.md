# React (Vite + React Router)

Source: the React tutorial, parts 2 and 4.
- https://docs.nhost.io/getting-started/tutorials/react/2-protected-routes
- https://docs.nhost.io/getting-started/tutorials/react/4-graphql-operations
- Minimal version: https://docs.nhost.io/getting-started/quickstart/react
- Full code: `examples/tutorials/nhost-react-tutorial` in the nhost/nhost repo

## Install and env

```bash
npm install @nhost/nhost-js react-router-dom
```

`.env` in the project root:

```bash
VITE_NHOST_REGION=<region>
VITE_NHOST_SUBDOMAIN=<subdomain>
```

For a local project use `local` for both, or leave them unset (the code falls back to `"local"`). Ask the user for Cloud values.

## Auth provider (`src/lib/nhost/AuthProvider.tsx`)

The tutorial creates the client inside a context provider and mirrors the session into React state. Compact version of the same pattern:

```tsx
import { createClient, type NhostClient } from "@nhost/nhost-js";
import type { StoredSession } from "@nhost/nhost-js/session";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

interface AuthContextType {
  user: StoredSession["user"] | null;
  session: StoredSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  nhost: NhostClient;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const nhost = useMemo(
    () =>
      createClient({
        region: import.meta.env.VITE_NHOST_REGION || "local",
        subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || "local",
      }),
    [],
  );

  useEffect(() => {
    setSession(nhost.getUserSession());
    setIsLoading(false);
    const unsubscribe = nhost.sessionStorage.onChange((s) => setSession(s));
    return unsubscribe;
  }, [nhost]);

  const value: AuthContextType = {
    user: session?.user || null,
    session,
    isAuthenticated: !!session,
    isLoading,
    nhost,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
```

The full tutorial version also tracks `session.refreshTokenId` and re-reads `nhost.getUserSession()` on `visibilitychange` / window `focus` to keep multiple tabs in sync. Add that if the user needs cross-tab sync.

Wrap the app: `<AuthProvider><RouterProvider router={router} /></AuthProvider>`.

## Protected routes (`src/components/ProtectedRoute.tsx`)

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function ProtectedRoute({ redirectTo = "/signin" }: { redirectTo?: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to={redirectTo} />;
  return <Outlet />;
}
```

Nest protected pages under it: `<Route element={<ProtectedRoute />}><Route path="profile" element={<Profile />} /></Route>`.

This is UI-level protection only. Data protection comes from GraphQL permissions (`database` skill).

## GraphQL in a component

```tsx
const { nhost } = useAuth();

const fetchTodos = useCallback(async () => {
  try {
    const response = await nhost.graphql.request<{ todos: Todo[] }>({
      query: `query GetTodos { todos(order_by: { created_at: desc }) { id title completed } }`,
    });
    setTodos(response.body.data?.todos || []);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to fetch todos");
  }
}, [nhost.graphql]);
```

Mutations pass `variables`. Do not send `user_id` from the client; the tutorial sets it with a permission preset from `X-Hasura-User-Id` (`database` skill).

## Sign out

```tsx
if (session) await nhost.auth.signOut({ refreshToken: session.refreshToken });
```

Sign-up / sign-in pages: `auth` skill, or https://docs.nhost.io/getting-started/tutorials/react/3-user-authentication
