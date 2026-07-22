import { describe, expect, it } from 'vitest';
import { parseTypesSdl } from '@/features/orgs/projects/graphql/actions/utils/parseTypesSdl';
import getActionSampleInputPayload from './getActionSampleInputPayload';

function parsePayload(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error(`Generated payload is not valid JSON: ${payload}`);
  }
}

function getInput(payload: string): Record<string, unknown> {
  return parsePayload(payload).input as Record<string, unknown>;
}

describe('getActionSampleInputPayload', () => {
  it('should return a default payload when no definition is provided', () => {
    const payload = parsePayload(getActionSampleInputPayload());

    expect(payload).toEqual({
      action: { name: 'actionName' },
      input: {},
      session_variables: { 'x-hasura-role': 'user' },
      request_query: '',
    });
  });

  it('should generate type-appropriate values for built-in scalars', () => {
    const input = getInput(
      getActionSampleInputPayload({
        name: 'myAction',
        arguments: [
          { name: 'count', type: 'Int!' },
          { name: 'ratio', type: 'Float' },
          { name: 'big', type: 'BigInt' },
          { name: 'enabled', type: 'Boolean!' },
          { name: 'title', type: 'String!' },
          { name: 'identifier', type: 'ID' },
        ],
      }),
    );

    expect(input.count).toEqual(expect.any(Number));
    expect(input.ratio).toEqual(expect.any(Number));
    expect(input.big).toEqual(expect.any(Number));
    expect(input.enabled).toBe(true);
    expect(input.title).toBe('title');
    expect(input.identifier).toBe('identifier');
  });

  it('should wrap list types in arrays, including nested lists', () => {
    const input = getInput(
      getActionSampleInputPayload({
        name: 'myAction',
        arguments: [
          { name: 'tags', type: '[String!]!' },
          { name: 'matrix', type: '[[Int]]' },
        ],
      }),
    );

    expect(input.tags).toEqual(['tags']);
    expect(input.matrix).toEqual([[expect.any(Number)]]);
  });

  it('should expand input objects recursively and use the first enum value', () => {
    const { types } = parseTypesSdl(`
      input AddressInput {
        street: String!
        zipCode: Int!
      }

      input UserInput {
        displayName: String!
        isAdmin: Boolean!
        address: AddressInput!
        role: Role!
      }

      enum Role {
        admin
        user
      }
    `);

    const input = getInput(
      getActionSampleInputPayload(
        {
          name: 'insertUser',
          arguments: [{ name: 'user', type: 'UserInput!' }],
        },
        types,
      ),
    );

    expect(input.user).toEqual({
      displayName: 'displayName',
      isAdmin: true,
      address: {
        street: 'street',
        zipCode: expect.any(Number),
      },
      role: 'admin',
    });
  });

  it('should fall back to the argument name for unknown and custom scalar types', () => {
    const { types } = parseTypesSdl('scalar Timestamp');

    const input = getInput(
      getActionSampleInputPayload(
        {
          name: 'myAction',
          arguments: [
            { name: 'createdAt', type: 'Timestamp!' },
            { name: 'mystery', type: 'UnknownType' },
          ],
        },
        types,
      ),
    );

    expect(input.createdAt).toBe('createdAt');
    expect(input.mystery).toBe('mystery');
  });

  it('should stop expanding self-referential input objects at the depth limit', () => {
    const { types } = parseTypesSdl(`
      input NodeInput {
        value: String!
        child: NodeInput
      }
    `);

    const input = getInput(
      getActionSampleInputPayload(
        {
          name: 'insertNode',
          arguments: [{ name: 'node', type: 'NodeInput!' }],
        },
        types,
      ),
    );

    let current = input.node as Record<string, unknown>;
    let depth = 0;
    while (
      typeof current.child === 'object' &&
      current.child !== null &&
      'value' in (current.child as Record<string, unknown>)
    ) {
      current = current.child as Record<string, unknown>;
      depth += 1;
      expect(depth).toBeLessThan(10);
    }
    expect(current.child).toEqual({});
  });
});
