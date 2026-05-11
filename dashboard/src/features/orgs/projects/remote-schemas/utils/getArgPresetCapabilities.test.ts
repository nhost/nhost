import { buildSchema, type GraphQLArgument } from 'graphql';
import getArgPresetCapabilities from './getArgPresetCapabilities';

const schema = buildSchema(`
  enum Role {
    ADMIN
    USER
  }
  scalar UUID
  input WhereInput {
    eq: String
  }
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
      where: WhereInput
      whereRequired: WhereInput!
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

describe('acceptsNull', () => {
  test('true for unwrapped scalars', () => {
    expect(caps('flag').acceptsNull).toBe(true);
    expect(caps('count').acceptsNull).toBe(true);
    expect(caps('name').acceptsNull).toBe(true);
    expect(caps('uid').acceptsNull).toBe(true);
  });

  test('true for nullable lists', () => {
    expect(caps('tags').acceptsNull).toBe(true);
    expect(caps('ints').acceptsNull).toBe(true);
  });

  test('false for NonNull-wrapped types', () => {
    expect(caps('flagRequired').acceptsNull).toBe(false);
    expect(caps('nameRequired').acceptsNull).toBe(false);
    expect(caps('idRequired').acceptsNull).toBe(false);
    expect(caps('roleRequired').acceptsNull).toBe(false);
    expect(caps('tagsRequired').acceptsNull).toBe(false);
  });
});

describe('acceptsBoolean', () => {
  test('true for Boolean and Boolean!', () => {
    expect(caps('flag').acceptsBoolean).toBe(true);
    expect(caps('flagRequired').acceptsBoolean).toBe(true);
  });

  test('false for non-Boolean scalars and enums', () => {
    expect(caps('count').acceptsBoolean).toBe(false);
    expect(caps('name').acceptsBoolean).toBe(false);
    expect(caps('uid').acceptsBoolean).toBe(false);
    expect(caps('role').acceptsBoolean).toBe(false);
  });

  test('false for list-of-Boolean (cannot emit bare true/false on a list arg)', () => {
    expect(caps('bools').acceptsBoolean).toBe(false);
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

  test('returns null for list-of-enum (cannot emit bare enum value on a list arg)', () => {
    expect(caps('enums').enumValues).toBeNull();
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

  test('false for list types', () => {
    expect(caps('tags').acceptsEmptyString).toBe(false);
    expect(caps('ints').acceptsEmptyString).toBe(false);
  });

  test('false for input-object types (cannot emit "" on an input-object arg)', () => {
    expect(caps('where').acceptsEmptyString).toBe(false);
    expect(caps('whereRequired').acceptsEmptyString).toBe(false);
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

  test('false for list types (preset directive on a list cannot take a bare session-variable string)', () => {
    expect(caps('tags').acceptsSessionVariable).toBe(false);
    expect(caps('enums').acceptsSessionVariable).toBe(false);
    expect(caps('bools').acceptsSessionVariable).toBe(false);
  });

  test('false for input-object types', () => {
    expect(caps('where').acceptsSessionVariable).toBe(false);
    expect(caps('whereRequired').acceptsSessionVariable).toBe(false);
  });
});
