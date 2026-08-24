export type GraphQLPlaygroundSelection = {
  userId: string;
  role: string;
};

interface ComposeRequestHeadersOptions {
  adminSecret: string;
  selection: GraphQLPlaygroundSelection;
  headersTabOverrides?: Record<string, unknown>;
}

/**
 * Later layers win case-insensitive key collisions.
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
    if (value === null || value === undefined) {
      continue;
    }

    setHeader(name, typeof value === 'string' ? value : String(value));
  }

  return headers;
}
