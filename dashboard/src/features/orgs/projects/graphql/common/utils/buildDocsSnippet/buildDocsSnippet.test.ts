import { buildSchema, type GraphQLObjectType, parse } from 'graphql';
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

  interface Node {
    id: uuid!
  }

  union SearchResult = users | posts

  scalar uuid
  scalar timestamptz

  type Query {
    users(limit: Int, offset: Int): [users!]!
    user(id: uuid!): users
    users_aggregate: users_aggregate!
    node(id: uuid!): Node
    search: [SearchResult!]!
    greet(name: String!, polite: Boolean): String
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

  it('selects the fields of an interface', () => {
    const root = schema.getQueryType()?.getFields();

    expect(buildFieldSnippet(root!.node)).toBe(
      ['node(id: $id) {', '  id', '}'].join('\n'),
    );
  });

  it('selects __typename on a union, so the snippet stays valid', () => {
    const root = schema.getQueryType()?.getFields();
    const snippet = buildFieldSnippet(root!.search);

    expect(snippet).toBe(['search {', '  __typename', '}'].join('\n'));
    expect(() => parse(`{ ${snippet} }`)).not.toThrow();
  });

  it('turns required arguments of a scalar field into variables', () => {
    const root = schema.getQueryType()?.getFields();
    const snippet = buildFieldSnippet(root!.greet);

    expect(snippet).toBe('greet(name: $name)');
    expect(() => parse(`query ($name: String!) { ${snippet} }`)).not.toThrow();
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

  describe('with tracked functions that return the table', () => {
    // Hasura sorts root fields by name, so the functions come first.
    const withFunctions = (tableField: string) =>
      buildSchema(`
        type posts {
          id: Int!
          title: String!
        }

        input search_posts_args {
          term: String
        }

        type Query {
          active_posts(limit: Int): [posts!]!
          search_posts(args: search_posts_args!, limit: Int): [posts!]!
          ${tableField}(limit: Int): [posts!]!
        }
      `);

    const queryFor = (tableSchema: ReturnType<typeof buildSchema>) =>
      buildTableQuery(
        tableSchema,
        tableSchema.getType('posts') as GraphQLObjectType,
      );

    it("picks the table's own field", () => {
      const query = queryFor(withFunctions('posts'));

      expect(query).toBe(
        [
          'query GetPosts {',
          '  posts(limit: 10) {',
          '    id',
          '    title',
          '  }',
          '}',
        ].join('\n'),
      );
      expect(() => parse(query!)).not.toThrow();
    });

    it('picks a field without required arguments when none is named after the table', () => {
      expect(queryFor(withFunctions('all_posts'))?.split('\n')[1]).toBe(
        '  active_posts(limit: 10) {',
      );
    });

    it('falls back to a function with required arguments', () => {
      const functionOnly = buildSchema(`
        type posts {
          id: Int!
        }

        input search_posts_args {
          term: String
        }

        type Query {
          search_posts(args: search_posts_args!): [posts!]!
        }
      `);

      expect(queryFor(functionOnly)?.split('\n')[0]).toBe(
        'query GetSearch_posts($args: search_posts_args!) {',
      );
    });
  });
});
