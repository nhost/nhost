import {
  buildClientSchema,
  buildSchema,
  type IntrospectionObjectType,
  introspectionFromSchema,
} from 'graphql';

export const TEST_SCHEMA_SDL = /* GraphQL */ `
  schema {
    query: query_root
    mutation: mutation_root
  }

  type query_root {
    "fetch users"
    users: [users!]!
    search(term: String!): [search_result!]!
  }

  type mutation_root {
    delete_users: Int
  }

  type users {
    id: ID!
    displayName: String!
    posts(limit: Int, where: posts_bool_exp): [posts!]!
    oldName: String @deprecated(reason: "Use displayName")
  }

  type posts {
    id: ID!
    title: String!
    author: users!
  }

  union search_result = users | posts

  input posts_bool_exp {
    _and: [posts_bool_exp!]
    title: String_comparison_exp
    status: post_status
  }

  input String_comparison_exp {
    _eq: String
  }

  enum post_status {
    DRAFT
    PUBLISHED
  }
`;

export function createTestSchema() {
  return buildSchema(TEST_SCHEMA_SDL);
}

/**
 * An introspection result whose `Query.search(filter: jsonb)` argument
 * defaults to `{a: 1}`, as a remote schema can declare it. graphql-js cannot
 * print that default, so it is set on the result instead of in SDL.
 */
export function createObjectDefaultIntrospection() {
  const introspection = introspectionFromSchema(
    buildSchema('scalar jsonb type Query { search(filter: jsonb): String }'),
  );
  const queryType = introspection.__schema.types.find(
    ({ name }) => name === 'Query',
  ) as IntrospectionObjectType;
  const filterArgument: { defaultValue?: string | null } =
    queryType.fields[0].args[0];

  filterArgument.defaultValue = '{a: 1}';

  return introspection;
}

export function createObjectDefaultSchema() {
  return buildClientSchema(createObjectDefaultIntrospection());
}
