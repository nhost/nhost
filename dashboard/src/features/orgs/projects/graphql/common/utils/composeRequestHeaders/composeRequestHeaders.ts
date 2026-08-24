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
  const headers: Record<string, string> = {};

  const setHeader = (name: string, value: string) => {
    const canonicalName = name.toLowerCase();

    headers[canonicalName] = value;
  };

  setHeader('content-type', 'application/json');
  setHeader('x-hasura-admin-secret', adminSecret);

  if (selection.userId) {
    setHeader('x-hasura-user-id', selection.userId);
  }

  if (selection.role) {
    setHeader('x-hasura-role', selection.role);
  }

  for (const [name, value] of Object.entries(headersTabOverrides ?? {})) {
    if (value == null) {
      continue;
    }

    setHeader(name, String(value));
  }

  return headers;
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
