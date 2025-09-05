# React Apollo with Nhost SDK

This guide demonstrates how to integrate GraphQL queries and mutations with React using Apollo Client and the Nhost SDK.

## Setup

### 1. Install Dependencies

```bash
npm install @apollo/client @nhost/nhost-js graphql
# or
yarn add @apollo/client @nhost/nhost-js graphql
# or
pnpm add @apollo/client @nhost/nhost-js graphql
```

### 2. Generate Types with GraphQL CodeGen

Install GraphQL CodeGen:

```bash
npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
```

Set up `codegen.ts`:

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
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-react-apollo",
      ],
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

## Integration Guide

### 1. Create an Auth Provider

Create an authentication context to manage the user session:

```typescript
// src/lib/nhost/AuthProvider.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { createClient, type NhostClient } from "@nhost/nhost-js";
import { type Session } from "@nhost/nhost-js/auth";

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

### 2. Create Apollo Client Integration

Configure Apollo Client with the Nhost authentication:

```typescript
// src/lib/graphql/apolloClient.ts
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { useAuth } from "../nhost/AuthProvider";
import { useMemo } from "react";
import type { NhostClient } from "@nhost/nhost-js";

export const createApolloClient = (nhost: NhostClient) => {
  const httpLink = createHttpLink({
    uri: nhost.graphql.url,
  });

  const authLink = setContext(async (_, prevContext) => {
    const resp = await nhost.refreshSession(60);
    const token = resp ? resp.accessToken : null;

    return {
      headers: {
        ...(prevContext["headers"] as Record<string, string>),
        Authorization: token ? `Bearer ${token}` : "",
      },
    };
  });

  const link = ApolloLink.from([authLink, httpLink]);

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
      },
    },
  });
};

export const useApolloClient = () => {
  const { nhost } = useAuth();
  return useMemo(() => createApolloClient(nhost), [nhost]);
};
```

### 3. Set Up Apollo Provider

Wrap your application with the Apollo Provider:

```typescript
// src/main.tsx or src/App.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import App from "./App";
import { AuthProvider } from "./lib/nhost/AuthProvider";
import { useApolloClient } from "./lib/graphql/apolloClient";

const AppWithProviders = () => {
  const apolloClient = useApolloClient();

  return (
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppWithProviders />
    </AuthProvider>
  </React.StrictMode>
);
```

### 4. Define GraphQL Operations

Create a GraphQL file with your queries and mutations:

```graphql
# src/lib/graphql/operations.graphql
query GetNinjaTurtlesWithComments {
  ninjaTurtles {
    id
    name
    description
    createdAt
    comments {
      id
      comment
      createdAt
      user {
        id
        email
        displayName
      }
    }
  }
}

mutation AddComment($ninjaTurtleId: uuid!, $comment: String!) {
  insert_comments_one(
    object: { ninjaTurtleId: $ninjaTurtleId, comment: $comment }
  ) {
    id
  }
}
```

### 5. Generate TypeScript Types

Run the code generator:

```bash
npx graphql-codegen
```

### 6. Use in Components

Use the generated hooks in your components:

```tsx
// src/pages/Home.tsx
import { useState } from "react";
import {
  useGetNinjaTurtlesWithCommentsQuery,
  useAddCommentMutation,
} from "../lib/graphql/__generated__/graphql";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Query for data
  const { loading, error, data, refetch } =
    useGetNinjaTurtlesWithCommentsQuery();

  // Mutation hook
  const [addComment] = useAddCommentMutation({
    onCompleted: () => {
      setCommentText("");
      setActiveCommentId(null);
      refetch();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }

  const handleAddComment = (turtleId: string) => {
    if (!commentText.trim()) return;

    addComment({
      variables: {
        ninjaTurtleId: turtleId,
        comment: commentText,
      },
    });
  };

  if (loading) return <div>Loading...</div>;
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
