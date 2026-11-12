import { getIntrospectionQuery, type IntrospectionQuery } from 'graphql';

export interface IntrospectGraphQLSchemaOptions {
  /**
   * The project's GraphQL endpoint.
   */
  url: string;
  adminSecret: string;
  /**
   * Role whose view of the schema is introspected.
   */
  role: string;
}

interface GraphQLIntrospectionResponse {
  data?: IntrospectionQuery | null;
  errors?: { message: string }[];
}

/**
 * Introspects the project's GraphQL schema as seen by the given role.
 */
export default async function introspectGraphQLSchema({
  url,
  adminSecret,
  role,
}: IntrospectGraphQLSchemaOptions): Promise<IntrospectionQuery> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
      'x-hasura-role': role,
    },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });

  let body: GraphQLIntrospectionResponse | null = null;

  try {
    body = await response.json();
  } catch {
    // Non-JSON bodies (e.g. a gateway error page) are reported by status below.
  }

  const errorMessage = body?.errors?.[0]?.message;

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (!response.ok) {
    throw new Error(
      `Schema introspection failed with status ${response.status}.`,
    );
  }

  if (!body?.data) {
    throw new Error('Schema introspection returned no data.');
  }

  return body.data;
}
