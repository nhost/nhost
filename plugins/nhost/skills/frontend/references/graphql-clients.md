# GraphQL clients and codegen (optional)

`nhost.graphql.request` is enough for most apps. Add a GraphQL client only if the user wants caching or already uses one. Each guide below points to a working React example in the nhost/nhost repo; read it before writing code.

| Tool | Docs page | Example |
|---|---|---|
| Apollo Client | https://docs.nhost.io/products/graphql/guides/react-apollo | `examples/guides/react-apollo` |
| urql | https://docs.nhost.io/products/graphql/guides/react-urql | `examples/guides/react-urql` |
| React Query (TanStack) | https://docs.nhost.io/products/graphql/guides/react-query | `examples/guides/react-query` |
| GraphQL Code Generator | https://docs.nhost.io/products/graphql/guides/codegen-nhost | `examples/guides/codegen-nhost` |

All examples keep the tutorial's `AuthProvider` / `useAuth()` and take the `nhost` client from it. The GraphQL endpoint is `nhost.graphql.url`. Do not install `@nhost/react-apollo` (deprecated).

## Apollo Client (`src/lib/graphql/apolloClient.ts`)

Attach the Nhost access token with an auth link; `refreshSession(60)` returns a fresh session, refreshing only if the token expires within 60 s:

```ts
import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import type { NhostClient } from "@nhost/nhost-js";

export const createApolloClient = (nhost: NhostClient) => {
  const httpLink = createHttpLink({ uri: nhost.graphql.url });
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
  return new ApolloClient({
    link: ApolloLink.from([authLink, httpLink]),
    cache: new InMemoryCache(),
  });
};
```

Build it with `useMemo(() => createApolloClient(nhost), [nhost])` inside the auth provider tree.

## urql (`src/lib/graphql/UrqlProvider.tsx`)

The example uses `@urql/exchange-auth`:

- `url`: the GraphQL endpoint (the example reads `VITE_NHOST_GRAPHQL_URL`, default `https://local.graphql.local.nhost.run/v1`; `nhost.graphql.url` gives the same value from the client).
- `preferGetMethod: false` (force POST).
- `addAuthToOperation`: append `Authorization: Bearer ${nhost.getUserSession()?.accessToken}` when a session exists.
- `didAuthError`: a GraphQL error message includes `JWTExpired`.
- `refreshAuth`: `await nhost.refreshSession(60)`; on failure, `nhost.auth.signOut({ refreshToken })`.
- Exchanges order: `[cacheExchange, authExchange(...), fetchExchange]`.

## React Query

No special client: wrap `nhost.graphql.request` in a fetcher and use it as the `queryFn`.

```ts
export const useAuthenticatedFetcher = <TData, TVariables>(document: string) => {
  const { nhost } = useAuth();
  return useCallback(
    async (variables?: TVariables): Promise<TData> => {
      const resp = await nhost.graphql.request<TData>({
        query: document,
        variables: variables as Record<string, unknown>,
      });
      if (!resp.body.data) throw new Error(`Response does not contain data: ${JSON.stringify(resp.body)}`);
      return resp.body.data;
    },
    [nhost, document],
  );
};
```

The `createClient` middleware attaches and refreshes the token, so no extra auth code is needed.

## GraphQL Code Generator (typed documents)

`nhost.graphql.request(document, variables)` accepts a `TypedDocumentNode` and infers result and variable types. Setup from the guide:

```bash
npm install @nhost/nhost-js graphql @graphql-typed-document-node/core
npm install -D @graphql-codegen/cli @graphql-codegen/client-preset @graphql-codegen/schema-ast
```

- `codegen.ts`: `schema` = the project's GraphQL URL, `documents: ['src/lib/graphql/**/*.graphql']`, `generates` with `preset: 'client'` (`persistedDocuments: false`, `fragmentMasking: false`) plus the custom plugin `./add-query-source-plugin.cjs`. Copy both files from the example.
- The custom plugin is required: the SDK reads the query text from `document.loc.source.body`, which the client preset does not set. Without it requests fail with "not a valid graphql query".
- Run `npx graphql-codegen` (or a `generate` script) after every schema or query change.
- Do not pass explicit generics when using a typed document; pass `{}` for queries without variables.

**Schema access and secrets:** the example's `codegen.ts` sends `x-hasura-admin-secret: nhost-admin-secret`, the default for a local project only. Point codegen at the local project (`https://local.graphql.local.nhost.run/v1`). Never write a Cloud project's admin secret into `codegen.ts` or any committed file; if the user needs Cloud introspection, read the secret from an environment variable that is not committed, and confirm with the user first. With the Nhost MCP server, `get-schema` can show the schema without codegen.
