# GraphQL Code Generation with Nhost SDK

This guide demonstrates how to use GraphQL Code Generator with TypedDocumentNode to get full type safety when working with the Nhost SDK.

## Overview

The Nhost SDK's GraphQL client supports `TypedDocumentNode` from `@graphql-typed-document-node/core`, allowing you to use generated types and documents for type-safe GraphQL operations. This guide shows you how to set up GraphQL Code Generator to work seamlessly with Nhost.

## Setup

### 1. Install Dependencies

```bash
npm install @nhost/nhost-js graphql
# or
yarn add @nhost/nhost-js graphql
# or
pnpm add @nhost/nhost-js graphql
```

### 2. Install GraphQL CodeGen

Install the necessary code generation packages:

```bash
npm install -D @graphql-codegen/cli @graphql-codegen/client-preset @graphql-codegen/schema-ast
# or
pnpm add -D @graphql-codegen/cli @graphql-codegen/client-preset @graphql-codegen/schema-ast
```

### 3. Configure GraphQL CodeGen

Create a `codegen.ts` file with the client preset configuration:

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
  documents: ["src/lib/graphql/**/*.graphql"],
  ignoreNoDocuments: true,
  generates: {
    "./src/lib/graphql/__generated__/": {
      preset: "client",
      presetConfig: {
        persistedDocuments: false,
      },
      plugins: [
        {
          "./add-query-source-plugin.cjs": {},
        },
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

### 4. Create the Custom Plugin

The Nhost SDK expects documents to have a `loc.source.body` property containing the query string. Create a custom plugin to add this:

**add-query-source-plugin.cjs:**

```javascript
// Custom GraphQL Codegen plugin to add loc.source.body to generated documents
// This allows the Nhost SDK to extract the query string without needing the graphql package

const { print } = require("graphql");

/**
 * @type {import('@graphql-codegen/plugin-helpers').PluginFunction}
 */
const plugin = (_schema, documents, _config) => {
  let output = "";

  for (const doc of documents) {
    if (!doc.document) continue;

    for (const definition of doc.document.definitions) {
      if (definition.kind === "OperationDefinition" && definition.name) {
        const operationName = definition.name.value;
        const documentName = `${operationName}Document`;

        // Create a document with just this operation
        const singleOpDocument = {
          kind: "Document",
          definitions: [definition],
        };

        // Use graphql print to convert AST to string
        const source = print(singleOpDocument);

        output += `
// Add query source to ${documentName}
if (${documentName}) {
  Object.assign(${documentName}, {
    loc: { source: { body: ${JSON.stringify(source)} } }
  });
}
`;
      }
    }
  }

  return output;
};

module.exports = { plugin };
```

## Integration Guide

### 1. Create an Auth Provider

Create an authentication context to manage the Nhost client and user session:

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

### 2. Set Up Your App Providers

Wrap your application with the Auth provider:

```tsx
// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./lib/nhost/AuthProvider";

const Root = () => (
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<Root />);
```

### 3. Define GraphQL Operations

Create GraphQL files with your queries and mutations:

```graphql
# src/lib/graphql/operations.graphql
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

### 4. Generate TypeScript Types

Run the code generator:

```bash
npx graphql-codegen
```

You can also add a script to your `package.json`:

```json
{
  "scripts": {
    "generate": "graphql-codegen --config codegen.ts"
  }
}
```

Then run:

```bash
npm run generate
# or
pnpm generate
```

### 5. Use in Components

Use the generated types and documents with the Nhost SDK:

```tsx
// src/pages/Home.tsx
import { type JSX, useCallback, useEffect, useState } from "react";
import {
  AddCommentDocument,
  GetNinjaTurtlesWithCommentsDocument,
  type GetNinjaTurtlesWithCommentsQuery,
} from "../lib/graphql/__generated__/graphql";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Home(): JSX.Element {
  const { isLoading, nhost } = useAuth();
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [data, setData] = useState<GetNinjaTurtlesWithCommentsQuery | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch ninja turtles data
  const fetchNinjaTurtles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await nhost.graphql.request(
        GetNinjaTurtlesWithCommentsDocument,
        {},
      );

      if (result.body.errors) {
        throw new Error(result.body.errors[0]?.message);
      }

      setData(result.body.data ?? null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  // Load data on mount
  useEffect(() => {
    if (!isLoading) {
      fetchNinjaTurtles();
    }
  }, [isLoading, fetchNinjaTurtles]);

  const addComment = async (ninjaTurtleId: string, comment: string) => {
    try {
      const result = await nhost.graphql.request(AddCommentDocument, {
        ninjaTurtleId,
        comment,
      });

      if (result.body.errors) {
        throw new Error(result.body.errors[0]?.message);
      }

      // Clear form and refetch data
      setCommentText("");
      setActiveCommentId(null);
      await fetchNinjaTurtles();
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  // ... rest of component
}
```

## Key Points

### Type-Safe GraphQL Requests

The Nhost SDK's `graphql.request()` method has overloads that support `TypedDocumentNode`:

```typescript
// Type inference works automatically
const result = await nhost.graphql.request(
  GetNinjaTurtlesWithCommentsDocument,
  {}, // Variables are type-checked
);

// result.body.data is typed as GetNinjaTurtlesWithCommentsQuery | undefined
```

### How It Works

1. **GraphQL Code Generator** creates `TypedDocumentNode` types and documents using the client preset
2. **Custom Plugin** adds the `loc.source.body` property to each document at runtime
3. **Nhost SDK** detects the `TypedDocumentNode`, extracts the query string from `loc.source.body`, and executes the request
4. **TypeScript** infers response types automatically based on the document types

### Benefits

- ✅ Full type safety for queries, mutations, and variables
- ✅ Automatic type inference - no manual type annotations needed
- ✅ Type-checked variables prevent runtime errors
- ✅ IntelliSense support in your IDE
- ✅ Compile-time errors for invalid queries or mismatched types

## Troubleshooting

### "not a valid graphql query" Error

If you see this error, make sure:
1. The custom plugin (`add-query-source-plugin.cjs`) is in place
2. The plugin is configured in your `codegen.ts`
3. You've run `pnpm generate` after adding the plugin

### TypeScript Errors

If you get type errors:
1. Make sure you're not passing explicit generic type parameters to `nhost.graphql.request()`
2. Let TypeScript infer types from the document
3. Pass an empty object `{}` for queries without variables

## Additional Resources

- [GraphQL Code Generator Docs](https://the-guild.dev/graphql/codegen)
- [Nhost Documentation](https://docs.nhost.io)
- [TypedDocumentNode](https://github.com/dotansimha/graphql-typed-document-node)
