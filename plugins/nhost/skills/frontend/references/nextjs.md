# Next.js (App Router)

Source: the Next.js tutorial (Next.js 16, `src/` dir, App Router), parts 2–4.
- https://docs.nhost.io/getting-started/tutorials/nextjs/2-protected-routes
- https://docs.nhost.io/getting-started/tutorials/nextjs/3-user-authentication
- https://docs.nhost.io/getting-started/tutorials/nextjs/4-graphql-operations
- Minimal (public data, no auth): https://docs.nhost.io/getting-started/quickstart/nextjs
- Full code: `examples/tutorials/nhost-nextjs-tutorial` in the nhost/nhost repo

## Model

The tutorial keeps all Nhost calls on the server: server components read the session, server actions do auth and mutations, and a proxy refreshes the session and protects routes. The session lives in a cookie named `DEFAULT_SESSION_KEY` (`nhostSession`). Client components receive data as props and call server actions. Follow this model unless the user asks otherwise.

## Env (`.env.local`)

```bash
NHOST_REGION=<region>
NHOST_SUBDOMAIN=<subdomain>
```

No `NEXT_PUBLIC_` prefix: only server code reads them. Local project: `local` / `local` (or unset; the code falls back to `"local"`).

## Server helper (`src/lib/nhost/server.tsx`)

Same logic as the tutorial (comments trimmed, `get` condensed). Two server clients, both built with `createServerClient` and cookie-backed `storage`:

```tsx
import { createServerClient, type NhostClient } from "@nhost/nhost-js";
import { DEFAULT_SESSION_KEY, type StoredSession } from "@nhost/nhost-js/session";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const key = DEFAULT_SESSION_KEY;

// For server components and server actions
export async function createNhostClient(): Promise<NhostClient> {
  const cookieStore = await cookies();
  return createServerClient({
    region: process.env["NHOST_REGION"] || "local",
    subdomain: process.env["NHOST_SUBDOMAIN"] || "local",
    storage: {
      get: (): StoredSession | null => {
        const s = cookieStore.get(key)?.value || null;
        return s ? (JSON.parse(s) as StoredSession) : null;
      },
      set: (value: StoredSession) => {
        cookieStore.set(key, JSON.stringify(value));
      },
      remove: () => {
        cookieStore.delete(key);
      },
    },
  });
}

// For the proxy: reads request cookies, writes response cookies, refreshes the session
export async function handleNhostProxy(
  request: NextRequest,
  response: NextResponse<unknown>,
): Promise<StoredSession | null> {
  const nhost = createServerClient({
    region: process.env["NHOST_REGION"] || "local",
    subdomain: process.env["NHOST_SUBDOMAIN"] || "local",
    storage: {
      get: (): StoredSession | null => {
        const raw = request.cookies.get(key)?.value || null;
        return raw ? (JSON.parse(raw) as StoredSession) : null;
      },
      set: (value: StoredSession) => {
        response.cookies.set({
          name: key,
          value: JSON.stringify(value),
          path: "/",
          httpOnly: false, // if set to true we can't access it in the client
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      },
      remove: () => {
        response.cookies.delete(key);
      },
    },
  });
  // refresh only if the token expires in the next 60 seconds
  return await nhost.refreshSession(60);
}
```

`createServerClient` does not auto-refresh tokens (to avoid races between concurrent server requests). Refreshing happens only in the proxy via `refreshSession(60)`, so the proxy must run on every page request.

## Proxy: refresh + route protection (`src/proxy.ts`)

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleNhostProxy } from "./lib/nhost/server";

const publicRoutes = ["/"]; // part 3: ["/", "/signin", "/signup", "/verify", "/verify/error"]

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  // Always call this so the session stays fresh, even on public routes
  const session = await handleNhostProxy(request, response);

  if (isPublicRoute) return response;
  if (!session) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
```

The tutorial targets Next.js 16, where this file is `src/proxy.ts` exporting `proxy`. The SDK's own docs call the same code "Next.js middleware". Check the project's Next.js version and use the file name and export that version expects; if unsure, ask the user.

## Reading the session in server components

```tsx
import { createNhostClient } from "../lib/nhost/server";

export default async function Profile() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  return <p>{session?.user?.displayName || session?.user?.email}</p>;
}
```

The navigation bar is a server component that does the same and shows links based on `session`.

## GraphQL

In a server component (initial data) or a `"use server"` action (mutations):

```ts
"use server";
import { createNhostClient } from "../../lib/nhost/server";

export async function addTodo(title: string) {
  try {
    const nhost = await createNhostClient();
    if (!nhost.getUserSession()) return { success: false, error: "Not authenticated" };
    const response = await nhost.graphql.request<{ insert_todos_one: Todo | null }>({
      query: `mutation InsertTodo($title: String!) { insert_todos_one(object: { title: $title }) { id title } }`,
      variables: { title },
    });
    return { success: true, todo: response.body.data?.insert_todos_one };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
```

The page server component fetches initial rows and passes them to a `"use client"` component as props (`<TodosClient initialTodos={...} />`).

## Sign out (server action)

```ts
"use server";
import { redirect } from "next/navigation";
import { createNhostClient } from "./server";

export async function signOut() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  if (session) await nhost.auth.signOut({ refreshToken: session.refreshToken });
  redirect("/");
}
```

Sign-in / sign-up server actions (`signInEmailPassword`, `signUpEmailPassword`, email verification route): `auth` skill, or tutorial part 3.

## Client-side client (optional)

The tutorial does not use Nhost in client components. If the user needs it, the SDK offers `CookieStorage` from `@nhost/nhost-js/session` for `createClient({ ..., storage: new CookieStorage({ secure: ... }) })`, which keeps the session in a browser cookie that the server can read. The docs have no Next.js walkthrough for this; tell the user it is off the documented path before using it.

## Do not

- Do not use `@nhost/nextjs` (deprecated) or `createClient` in server components.
- Do not put the admin secret in `NEXT_PUBLIC_*` vars or client components. Server-only admin access belongs in server code reading a secret env var, and only if the user asks for it.
