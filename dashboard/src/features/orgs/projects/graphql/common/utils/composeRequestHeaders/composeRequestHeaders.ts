import type { Transport } from '@graphiql/toolkit';

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
  transport: Transport;
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

  // The transport spreads these into a plain object and graphql-ws
  // JSON-serializes them, so a Headers instance would silently reduce to {}.
  return Object.fromEntries(headers);
}

/**
 * Sends every request with the composed headers. GraphiQL passes the Headers
 * tab as the request's headers, so they override the selection.
 */
export function withRequestHeaders({
  transport,
  adminSecret,
  selection,
}: WithRequestHeadersOptions): Transport {
  // Getters, not a spread: the method and supported methods change after
  // discovery, and a spread would copy their first values.
  return {
    get url() {
      return transport.url;
    },
    get method() {
      return transport.method;
    },
    get methodOverride() {
      return transport.methodOverride;
    },
    get supportedMethods() {
      return transport.supportedMethods;
    },
    setMethod: transport.setMethod,
    subscribe: transport.subscribe,
    send: (request) =>
      transport.send({
        ...request,
        headers: composeRequestHeaders({
          adminSecret,
          selection,
          headersTabOverrides: request.headers,
        }),
      }),
  };
}
