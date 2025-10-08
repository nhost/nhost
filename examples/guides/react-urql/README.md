# React with urql and Nhost SDK

This guide demonstrates how to integrate GraphQL queries and mutations with React using urql and the Nhost SDK.

## Setup

### 1. Install Dependencies

```bash
npm install urql @urql/exchange-auth @nhost/nhost-js graphql @graphql-typed-document-node/core
# or
yarn add urql @urql/exchange-auth @nhost/nhost-js graphql @graphql-typed-document-node/core
# or
pnpm add urql @urql/exchange-auth @nhost/nhost-js graphql @graphql-typed-document-node/core
```

### 2. Install GraphQL CodeGen for Development

```bash
npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typed-document-node @graphql-codegen/schema-ast
# or
yarn add -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typed-document-node @graphql-codegen/schema-ast
# or
pnpm add -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typed-document-node @graphql-codegen/schema-ast
```

### 3. Configure GraphQL CodeGen

Create a `codegen.ts` file in your project root:

```typescript
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: [
    {
      "https://local.graphql.local.nhost.run/v1": {
        headers: {
          "x-hasura-admin-secret": "nhost-admin-secret",
        },
      },
    },
  ],
  documents: ["src/**/*.ts"],
  ignoreNoDocuments: true,
  generates: {
    "./src/lib/graphql/__generated__/graphql.ts": {
      documents: ["src/lib/graphql/**/*.graphql"],
      plugins: ["typescript", "typescript-operations", "typed-document-node"],
      config: {
        scalars: {
          UUID: "string",
          uuid: "string",
          timestamptz: "string",
          jsonb: "Record<string, any>",
          bigint: "number",
          bytea: "Buffer",
          citext: "string",
        },
        useTypeImports: true,
      },
    },
    "./schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
```

Add a script to your `package.json`:

```json
{
  "scripts": {
    "generate": "graphql-codegen --config codegen.ts"
  }
}
```

## Integration Guide

### 1. Create an Auth Provider

Create an authentication context to manage the user session:

```typescript
// src/lib/nhost/AuthProvider.tsx (see file for full code)
import { createClient, type NhostClient } from "@nhost/nhost-js";
import type { Session } from "@nhost/nhost-js/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface AuthContextType {
  user: Session["user"] | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  nhost: NhostClient;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Create the nhost client
  const nhost = useMemo(
    () =>
      createClient({
        region: import.meta.env.VITE_NHOST_REGION || "local",
        subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || "local",
      }),
    [],
  );

  useEffect(() => {
    setIsLoading(true);
    const currentSession = nhost.getUserSession();
    setUser(currentSession?.user || null);
    setSession(currentSession);
    setIsAuthenticated(!!currentSession);
    setIsLoading(false);

    const unsubscribe = nhost.sessionStorage.onChange((currentSession) => {
      setUser(currentSession?.user || null);
      setSession(currentSession);
      setIsAuthenticated(!!currentSession);
    });

    return () => {
      unsubscribe();
    };
  }, [nhost]);

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    nhost,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
```

### 2. Create urql Provider

Set up the urql client with authentication:

```typescript
// src/lib/graphql/UrqlProvider.tsx
import { authExchange } from "@urql/exchange-auth";
import type { ReactNode } from "react";
import {
  type Client,
  cacheExchange,
  createClient,
  fetchExchange,
  Provider,
} from "urql";
import { useAuth } from "../nhost/AuthProvider";

export const UrqlProvider = ({ children }: { children: ReactNode }) => {
  const { nhost } = useAuth();

  const client: Client = createClient({
    url:
      import.meta.env.VITE_NHOST_GRAPHQL_URL ||
      "https://local.graphql.local.nhost.run/v1",
    // Force POST requests (Hasura interprets GET requests as persisted queries)
    preferGetMethod: false,
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => {
        return {
          addAuthToOperation(operation) {
            const session = nhost.getUserSession();
            if (!session?.accessToken) {
              return operation;
            }

            return utils.appendHeaders(operation, {
              Authorization: `Bearer ${session.accessToken}`,
            });
          },
          didAuthError(error) {
            return error.graphQLErrors.some((e) =>
              e.message.includes("JWTExpired"),
            );
          },
          async refreshAuth() {
            const currentSession = nhost.getUserSession();
            if (!currentSession?.refreshToken) {
              return;
            }

            try {
              await nhost.refreshSession(60);
            } catch (e: unknown) {
              console.error(
                "Error refreshing session:",
                e instanceof Error ? e : "Unknown error",
              );
              await nhost.auth.signOut({
                refreshToken: currentSession.refreshToken,
              });
            }
          },
        };
      }),
      fetchExchange,
    ],
  });

  return <Provider value={client}>{children}</Provider>;
};
```

### 3. Set Up Your App Providers

Wrap your application with the Auth and urql providers:

```tsx
// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { UrqlProvider } from "./lib/graphql/UrqlProvider";
import { AuthProvider } from "./lib/nhost/AuthProvider";

const Root = () => (
  <React.StrictMode>
    <AuthProvider>
      <UrqlProvider>
        <App />
      </UrqlProvider>
    </AuthProvider>
  </React.StrictMode>
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<Root />);
```

### 4. Define GraphQL Operations

Create a GraphQL file with your queries and mutations:

```graphql
# src/lib/graphql/queries.graphql
query GetNinjaTurtlesWithComments {
  ninjaTurtles {
    id
    name
    description
    createdAt
    updatedAt
    comments {
      id
      comment
      createdAt
      user {
        id
        displayName
        email
      }
    }
  }
}

mutation AddComment($ninjaTurtleId: uuid!, $comment: String!) {
  insertComment(object: { ninjaTurtleId: $ninjaTurtleId, comment: $comment }) {
    id
    comment
    createdAt
    ninjaTurtleId
  }
}
```

### 5. Generate TypeScript Types

Run the code generator:

```bash
npm run generate
# or
yarn generate
# or
pnpm generate
```

This will generate typed document nodes in `src/lib/graphql/__generated__/graphql.ts`.

### 6. Use in Components

Use the generated document nodes with urql hooks in your components:

```tsx
// src/pages/Home.tsx
import { type JSX, useState } from "react";
import { useMutation, useQuery } from "urql";
import {
  AddCommentDocument,
  GetNinjaTurtlesWithCommentsDocument,
} from "../lib/graphql/__generated__/graphql";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Home(): JSX.Element {
  const { isLoading } = useAuth();
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Query for data
  const [{ data, fetching: loading, error }] = useQuery({
    query: GetNinjaTurtlesWithCommentsDocument,
  });

  // Mutation hook
  const [, addComment] = useMutation(AddCommentDocument);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleAddComment = async (turtleId: string) => {
    if (!commentText.trim()) return;

    const result = await addComment({
      ninjaTurtleId: turtleId,
      comment: commentText,
    });

    if (!result.error) {
      setCommentText("");
      setActiveCommentId(null);
    }
  };

  if (loading) return <div>Loading ninja turtles...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const ninjaTurtles = data?.ninjaTurtles || [];

  return (
    <div>
      <h1>Ninja Turtles</h1>
      {ninjaTurtles.map((turtle) => (
        <div key={turtle.id}>
          <h2>{turtle.name}</h2>
          <p>{turtle.description}</p>

          {/* Comments section */}
          <div>
            <h3>Comments ({turtle.comments.length})</h3>

            {turtle.comments.map((comment) => (
              <div key={comment.id}>
                <p>{comment.comment}</p>
                <small>
                  By{" "}
                  {comment.user?.displayName ||
                    comment.user?.email ||
                    "Anonymous"}
                </small>
              </div>
            ))}

            {activeCommentId === turtle.id ? (
              <div>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add your comment..."
                />
                <div>
                  <button onClick={() => setActiveCommentId(null)}>
                    Cancel
                  </button>
                  <button onClick={() => handleAddComment(turtle.id)}>
                    Submit
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setActiveCommentId(turtle.id)}>
                Add a comment
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Key Features

- **Type Safety**: Full TypeScript support with generated types from your GraphQL schema
- **Authentication**: Automatic token management with Nhost's auth exchange
- **Token Refresh**: Automatic JWT token refresh when expired
- **Caching**: Built-in document caching with urql's cache exchange
- **POST Requests**: Configured to use POST requests (Hasura compatibility)

## Important Configuration Notes

### Hasura Compatibility

When using urql with Hasura, it's important to set `preferGetMethod: false` in the client configuration. This is because:

- urql v5 defaults to using GET requests for queries (for better HTTP caching)
- Hasura interprets GET requests as persisted query attempts
- Setting `preferGetMethod: false` forces POST requests for all operations

### Authentication Exchange

The `authExchange` from `@urql/exchange-auth` handles:

- Adding the JWT access token to every request
- Detecting authentication errors (expired tokens)
- Automatically refreshing tokens when needed
- Signing out users when token refresh fails

This ensures seamless authenticated GraphQL requests throughout your application.
