import { buildSchema, type GraphQLSchema } from 'graphql';
import getSchemaNodeDetails from './getSchemaNodeDetails';
import { getNodeChildren, getOperationNodes } from './schemaTreeItems';
import { createTestSchema } from './testSchema';
import type { SchemaTreeNode } from './types';

const schema = createTestSchema();

/**
 * Walks the tree by node names, the way a user expands it, e.g.
 * `['Query', 'users', 'posts']`.
 */
function getNode(
  path: string[],
  fromSchema: GraphQLSchema = schema,
): SchemaTreeNode {
  const [operationName, ...rest] = path;
  let node = getOperationNodes(fromSchema).find(
    ({ name }) => name === operationName,
  );

  for (const name of rest) {
    node = node
      ? getNodeChildren(fromSchema, node).find((child) => child.name === name)
      : undefined;
  }

  if (!node) {
    throw new Error(`No node at ${path.join(' > ')}`);
  }

  return node;
}

describe('getSchemaNodeDetails', () => {
  it.each([
    [['Query'], 'Operation'],
    [['Query', 'users'], 'Query field'],
    [['Mutation', 'delete_users'], 'Mutation field'],
    [['Query', 'users', 'id'], 'Field'],
    [['Query', 'users', 'posts', 'limit'], 'Argument'],
    [['Query', 'users', 'posts', 'where', 'title'], 'Input field'],
    [['Query', 'users', 'posts', 'where', 'status', 'DRAFT'], 'Enum value'],
    [['Query', 'search', 'posts'], 'Union member'],
  ])('labels %j as %s', (path, kindLabel) => {
    expect(getSchemaNodeDetails(schema, getNode(path)).kindLabel).toBe(
      kindLabel,
    );
  });

  it('labels root fields of a subscription', () => {
    const subscriptionSchema = buildSchema(`
      type Query { ping: String }
      type Subscription { messages: [String!]! }
    `);

    expect(
      getSchemaNodeDetails(
        subscriptionSchema,
        getNode(['Subscription', 'messages'], subscriptionSchema),
      ).kindLabel,
    ).toBe('Subscription field');
  });

  it('lists the arguments of a field', () => {
    const details = getSchemaNodeDetails(
      schema,
      getNode(['Query', 'users', 'posts']),
    );

    expect(details.arguments.map(({ name }) => name)).toEqual([
      'limit',
      'where',
    ]);
    expect(details.arguments[1]).toMatchObject({
      kind: 'argument',
      typeLabel: 'posts_bool_exp',
    });
  });

  it('lists no arguments for anything but a field', () => {
    expect(
      getSchemaNodeDetails(
        schema,
        getNode(['Query', 'users', 'posts', 'where']),
      ).arguments,
    ).toEqual([]);
    expect(getSchemaNodeDetails(schema, getNode(['Query'])).arguments).toEqual(
      [],
    );
  });

  it('includes the description of the named type', () => {
    const describedSchema = buildSchema(`
      type Query { users: [users!]! }

      "columns and relationships of users"
      type users { id: ID! }
    `);

    expect(
      getSchemaNodeDetails(
        describedSchema,
        getNode(['Query', 'users'], describedSchema),
      ).typeDescription,
    ).toBe('columns and relationships of users');
  });

  it('has no type description for a type without one or a node without a type', () => {
    expect(
      getSchemaNodeDetails(schema, getNode(['Query', 'users'])).typeDescription,
    ).toBeUndefined();
    expect(
      getSchemaNodeDetails(
        schema,
        getNode(['Query', 'users', 'posts', 'where', 'status', 'DRAFT']),
      ).typeDescription,
    ).toBeUndefined();
  });
});
