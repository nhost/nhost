import type { Fetcher } from '@graphiql/toolkit';

export type GraphQLPlaygroundSelection = {
  userId: string;
  role: string;
};

interface ComposeRequestHeadersOptions {
  adminSecret: string;
  selection: GraphQLPlaygroundSelection;
  headersTabOverrides?: Record<string, unknown>;
}

interface WithRequestHeadersOptions {
  fetcher: Fetcher;
  adminSecret: string;
  selection: GraphQLPlaygroundSelection;
}

/**
 * Composes base, selection, and Headers-tab headers in precedence order,
 * normalizing header names to lowercase.
 */
export default function composeRequestHeaders({
  adminSecret,
  selection,
  headersTabOverrides,
}: ComposeRequestHeadersOptions): Record<string, string> {
  const headers = new Headers();

  headers.set('content-type', 'application/json');
  headers.set('x-hasura-admin-secret', adminSecret);

  if (selection.userId) {
    headers.set('x-hasura-user-id', selection.userId);
  }

  if (selection.role) {
    headers.set('x-hasura-role', selection.role);
  }

  for (const [name, value] of Object.entries(headersTabOverrides ?? {})) {
    if (value == null) {
      continue;
    }

    headers.set(name, String(value));
  }

  // GraphiQL spreads these into a plain object and graphql-ws JSON-serializes
  // them, so a Headers instance would silently reduce to {}.
  return Object.fromEntries(headers);
}

export function withRequestHeaders({
  fetcher,
  adminSecret,
  selection,
}: WithRequestHeadersOptions): Fetcher {
  return (graphQLParams, fetcherOpts) =>
    fetcher(graphQLParams, {
      ...fetcherOpts,
      headers: composeRequestHeaders({
        adminSecret,
        selection,
        headersTabOverrides: fetcherOpts?.headers,
      }),
    });
}
