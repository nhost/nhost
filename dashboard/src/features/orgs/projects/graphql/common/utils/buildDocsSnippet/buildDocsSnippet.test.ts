import { buildSchema, type GraphQLObjectType, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { buildFieldSnippet, buildTableQuery } from './buildDocsSnippet';

const schema = buildSchema(`
  type users {
    id: uuid!
    email: String
    createdAt: timestamptz!
    posts(limit: Int, where: posts_bool_exp): [posts!]!
    posts_aggregate(limit: Int): posts_aggregate!
  }

  type posts {
    id: uuid!
    title: String!
    oldTitle: String @deprecated
  }

  type posts_aggregate {
    aggregate: posts_aggregate_fields
    nodes: [posts!]!
  }

  type posts_aggregate_fields {
    count(distinct: Boolean): Int!
  }

  type users_aggregate {
    nodes: [users!]!
  }

  input posts_bool_exp {
    id: uuid
  }

  scalar uuid
  scalar timestamptz

  type Query {
    users(limit: Int, offset: Int): [users!]!
    user(id: uuid!): users
    users_aggregate: users_aggregate!
  }
`);

const users = schema.getType('users') as GraphQLObjectType;
const fields = users.getFields();

describe('buildFieldSnippet', () => {
  it('returns the name of a column', () => {
    expect(buildFieldSnippet(fields.email)).toBe('email');
  });

  it('selects the columns of a relationship, with a limit for lists', () => {
    expect(buildFieldSnippet(fields.posts)).toBe(
      ['posts(limit: 10) {', '  id', '  title', '}'].join('\n'),
    );
  });

  it('goes one level into an aggregate', () => {
    expect(buildFieldSnippet(fields.posts_aggregate)).toBe(
      ['posts_aggregate {', '  aggregate {', '    count', '  }', '}'].join(
        '\n',
      ),
    );
  });

  it('turns required arguments into variables', () => {
    const root = schema.getQueryType()?.getFields();

    expect(buildFieldSnippet(root!.user).split('\n')[0]).toBe(
      'user(id: $id) {',
    );
  });
});

describe('buildTableQuery', () => {
  it('builds a valid query that lists the rows of a table', () => {
    const query = buildTableQuery(schema, users);

    expect(query).toBe(
      [
        'query GetUsers {',
        '  users(limit: 10) {',
        '    id',
        '    email',
        '    createdAt',
        '  }',
        '}',
      ].join('\n'),
    );
    expect(() => parse(query!)).not.toThrow();
  });

  it('returns null when no root field lists the type', () => {
    expect(
      buildTableQuery(schema, schema.getType('posts') as GraphQLObjectType),
    ).toBeNull();
  });
});
