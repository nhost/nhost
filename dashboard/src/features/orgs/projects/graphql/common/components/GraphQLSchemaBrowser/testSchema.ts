import { buildSchema } from 'graphql';

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
