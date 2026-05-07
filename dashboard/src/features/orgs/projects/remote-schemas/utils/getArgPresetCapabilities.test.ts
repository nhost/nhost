import { buildSchema, type GraphQLArgument } from 'graphql';
import getArgPresetCapabilities from './getArgPresetCapabilities';

const schema = buildSchema(`
  enum Role {
    ADMIN
    USER
  }
  scalar UUID
  type Query {
    test(
      flag: Boolean
      flagRequired: Boolean!
      count: Int
      countRequired: Int!
      pi: Float
      name: String
      nameRequired: String!
      id: ID
      idRequired: ID!
      role: Role
      roleRequired: Role!
      uid: UUID
      uidRequired: UUID!
      tags: [String!]
      tagsRequired: [String!]!
      ints: [Int]
      bools: [Boolean!]!
      enums: [Role!]
    ): String
  }
`);

function arg(name: string): GraphQLArgument {
  const queryType = schema.getQueryType();
  const field = queryType?.getFields().test;
  const found = field?.args.find((a) => a.name === name);
  if (!found) {
    throw new Error(`Could not find arg ${name} in test schema`);
  }
  return found;
}

function caps(name: string) {
  return getArgPresetCapabilities(arg(name));
}

describe('isNullable', () => {
  test('true for unwrapped scalars', () => {
    expect(caps('flag').isNullable).toBe(true);
    expect(caps('count').isNullable).toBe(true);
    expect(caps('name').isNullable).toBe(true);
    expect(caps('uid').isNullable).toBe(true);
  });

  test('true for nullable lists', () => {
    expect(caps('tags').isNullable).toBe(true);
    expect(caps('ints').isNullable).toBe(true);
  });

  test('false for NonNull-wrapped types', () => {
    expect(caps('flagRequired').isNullable).toBe(false);
    expect(caps('nameRequired').isNullable).toBe(false);
    expect(caps('idRequired').isNullable).toBe(false);
    expect(caps('roleRequired').isNullable).toBe(false);
    expect(caps('tagsRequired').isNullable).toBe(false);
  });
});

describe('isBoolean', () => {
  test('true for Boolean and Boolean!', () => {
    expect(caps('flag').isBoolean).toBe(true);
    expect(caps('flagRequired').isBoolean).toBe(true);
  });

  test('true for [Boolean!]! (base type unwraps to Boolean)', () => {
    expect(caps('bools').isBoolean).toBe(true);
  });

  test('false for non-Boolean scalars and enums', () => {
    expect(caps('count').isBoolean).toBe(false);
    expect(caps('name').isBoolean).toBe(false);
    expect(caps('uid').isBoolean).toBe(false);
    expect(caps('role').isBoolean).toBe(false);
  });
});

describe('isList', () => {
  test('true for [T] and [T]!', () => {
    expect(caps('tags').isList).toBe(true);
    expect(caps('tagsRequired').isList).toBe(true);
    expect(caps('ints').isList).toBe(true);
    expect(caps('bools').isList).toBe(true);
    expect(caps('enums').isList).toBe(true);
  });

  test('false for unwrapped scalars and enums (even non-null)', () => {
    expect(caps('flag').isList).toBe(false);
    expect(caps('flagRequired').isList).toBe(false);
    expect(caps('name').isList).toBe(false);
    expect(caps('nameRequired').isList).toBe(false);
    expect(caps('role').isList).toBe(false);
    expect(caps('uid').isList).toBe(false);
  });
});

describe('enumValues', () => {
  test('returns enum values for Enum and Enum!', () => {
    expect(caps('role').enumValues?.map((v) => v.name)).toEqual([
      'ADMIN',
      'USER',
    ]);
    expect(caps('roleRequired').enumValues?.map((v) => v.name)).toEqual([
      'ADMIN',
      'USER',
    ]);
  });

  test('returns enum values for [Enum!] (base type unwraps to Role)', () => {
    expect(caps('enums').enumValues?.map((v) => v.name)).toEqual([
      'ADMIN',
      'USER',
    ]);
  });

  test('returns null for non-enum types', () => {
    expect(caps('flag').enumValues).toBeNull();
    expect(caps('count').enumValues).toBeNull();
    expect(caps('name').enumValues).toBeNull();
    expect(caps('uid').enumValues).toBeNull();
  });
});

describe('acceptsEmptyString', () => {
  test('true for string-like scalars', () => {
    expect(caps('name').acceptsEmptyString).toBe(true);
    expect(caps('nameRequired').acceptsEmptyString).toBe(true);
    expect(caps('id').acceptsEmptyString).toBe(true);
    expect(caps('uid').acceptsEmptyString).toBe(true);
  });

  test('false for Boolean / Int / Float / Enum', () => {
    expect(caps('flag').acceptsEmptyString).toBe(false);
    expect(caps('count').acceptsEmptyString).toBe(false);
    expect(caps('pi').acceptsEmptyString).toBe(false);
    expect(caps('role').acceptsEmptyString).toBe(false);
  });
});

describe('acceptsSessionVariable', () => {
  test('true for built-in scalars and enums (any nullability)', () => {
    expect(caps('flag').acceptsSessionVariable).toBe(true);
    expect(caps('count').acceptsSessionVariable).toBe(true);
    expect(caps('pi').acceptsSessionVariable).toBe(true);
    expect(caps('name').acceptsSessionVariable).toBe(true);
    expect(caps('id').acceptsSessionVariable).toBe(true);
    expect(caps('role').acceptsSessionVariable).toBe(true);
  });

  test('true for custom scalars', () => {
    expect(caps('uid').acceptsSessionVariable).toBe(true);
    expect(caps('uidRequired').acceptsSessionVariable).toBe(true);
  });

  test('true for lists with scalar/enum base types', () => {
    expect(caps('tags').acceptsSessionVariable).toBe(true);
    expect(caps('enums').acceptsSessionVariable).toBe(true);
  });
});
