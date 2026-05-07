import { buildSchema, type GraphQLArgument } from 'graphql';
import {
  acceptsEmptyStringLiteral,
  acceptsSessionVariable,
  formatPresetForInput,
  getEnumValuesForArg,
  isBooleanArg,
  isListArg,
  isNullableArg,
} from './presetInputHelpers';

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

describe('isNullableArg', () => {
  test('returns true for unwrapped scalars', () => {
    expect(isNullableArg(arg('flag'))).toBe(true);
    expect(isNullableArg(arg('count'))).toBe(true);
    expect(isNullableArg(arg('name'))).toBe(true);
    expect(isNullableArg(arg('uid'))).toBe(true);
  });

  test('returns true for nullable lists', () => {
    expect(isNullableArg(arg('tags'))).toBe(true);
    expect(isNullableArg(arg('ints'))).toBe(true);
  });

  test('returns false for NonNull-wrapped types', () => {
    expect(isNullableArg(arg('flagRequired'))).toBe(false);
    expect(isNullableArg(arg('nameRequired'))).toBe(false);
    expect(isNullableArg(arg('idRequired'))).toBe(false);
    expect(isNullableArg(arg('roleRequired'))).toBe(false);
    expect(isNullableArg(arg('tagsRequired'))).toBe(false);
  });
});

describe('isBooleanArg', () => {
  test('returns true for Boolean and Boolean!', () => {
    expect(isBooleanArg(arg('flag'))).toBe(true);
    expect(isBooleanArg(arg('flagRequired'))).toBe(true);
  });

  test('returns true for [Boolean!]! (base type unwraps to Boolean)', () => {
    expect(isBooleanArg(arg('bools'))).toBe(true);
  });

  test('returns false for non-Boolean scalars and enums', () => {
    expect(isBooleanArg(arg('count'))).toBe(false);
    expect(isBooleanArg(arg('name'))).toBe(false);
    expect(isBooleanArg(arg('uid'))).toBe(false);
    expect(isBooleanArg(arg('role'))).toBe(false);
  });
});

describe('isListArg', () => {
  test('returns true for [T] and [T]!', () => {
    expect(isListArg(arg('tags'))).toBe(true);
    expect(isListArg(arg('tagsRequired'))).toBe(true);
    expect(isListArg(arg('ints'))).toBe(true);
    expect(isListArg(arg('bools'))).toBe(true);
    expect(isListArg(arg('enums'))).toBe(true);
  });

  test('returns false for unwrapped scalars and enums (even non-null)', () => {
    expect(isListArg(arg('flag'))).toBe(false);
    expect(isListArg(arg('flagRequired'))).toBe(false);
    expect(isListArg(arg('name'))).toBe(false);
    expect(isListArg(arg('nameRequired'))).toBe(false);
    expect(isListArg(arg('role'))).toBe(false);
    expect(isListArg(arg('uid'))).toBe(false);
  });
});

describe('getEnumValuesForArg', () => {
  test('returns enum values for Enum and Enum!', () => {
    const nullable = getEnumValuesForArg(arg('role'));
    expect(nullable?.map((v) => v.name)).toEqual(['ADMIN', 'USER']);

    const required = getEnumValuesForArg(arg('roleRequired'));
    expect(required?.map((v) => v.name)).toEqual(['ADMIN', 'USER']);
  });

  test('returns enum values for [Enum!] (base type unwraps to Role)', () => {
    const list = getEnumValuesForArg(arg('enums'));
    expect(list?.map((v) => v.name)).toEqual(['ADMIN', 'USER']);
  });

  test('returns null for non-enum types', () => {
    expect(getEnumValuesForArg(arg('flag'))).toBeNull();
    expect(getEnumValuesForArg(arg('count'))).toBeNull();
    expect(getEnumValuesForArg(arg('name'))).toBeNull();
    expect(getEnumValuesForArg(arg('uid'))).toBeNull();
  });
});

describe('acceptsEmptyStringLiteral', () => {
  test('returns true for string-like scalars', () => {
    expect(acceptsEmptyStringLiteral(arg('name'))).toBe(true);
    expect(acceptsEmptyStringLiteral(arg('nameRequired'))).toBe(true);
    expect(acceptsEmptyStringLiteral(arg('id'))).toBe(true);
    expect(acceptsEmptyStringLiteral(arg('uid'))).toBe(true);
  });

  test('returns false for Boolean / Int / Float / Enum', () => {
    expect(acceptsEmptyStringLiteral(arg('flag'))).toBe(false);
    expect(acceptsEmptyStringLiteral(arg('count'))).toBe(false);
    expect(acceptsEmptyStringLiteral(arg('pi'))).toBe(false);
    expect(acceptsEmptyStringLiteral(arg('role'))).toBe(false);
  });
});

describe('acceptsSessionVariable', () => {
  test('returns true for built-in scalars and enums (any nullability)', () => {
    expect(acceptsSessionVariable(arg('flag'))).toBe(true);
    expect(acceptsSessionVariable(arg('count'))).toBe(true);
    expect(acceptsSessionVariable(arg('pi'))).toBe(true);
    expect(acceptsSessionVariable(arg('name'))).toBe(true);
    expect(acceptsSessionVariable(arg('id'))).toBe(true);
    expect(acceptsSessionVariable(arg('role'))).toBe(true);
  });

  test('returns true for custom scalars', () => {
    expect(acceptsSessionVariable(arg('uid'))).toBe(true);
    expect(acceptsSessionVariable(arg('uidRequired'))).toBe(true);
  });

  test('returns true for lists with scalar/enum base types', () => {
    expect(acceptsSessionVariable(arg('tags'))).toBe(true);
    expect(acceptsSessionVariable(arg('enums'))).toBe(true);
  });
});

describe('formatPresetForInput', () => {
  test('undefined and null both render as empty string', () => {
    expect(formatPresetForInput(undefined)).toBe('');
    expect(formatPresetForInput(null)).toBe('');
  });

  test('booleans render as their string form', () => {
    expect(formatPresetForInput(true)).toBe('true');
    expect(formatPresetForInput(false)).toBe('false');
  });

  test('numbers render as their string form', () => {
    expect(formatPresetForInput(0)).toBe('0');
    expect(formatPresetForInput(5431)).toBe('5431');
    expect(formatPresetForInput(3.14)).toBe('3.14');
  });

  test('strings pass through unchanged', () => {
    expect(formatPresetForInput('')).toBe('');
    expect(formatPresetForInput('hello')).toBe('hello');
    expect(formatPresetForInput('X-Hasura-User-Id')).toBe('X-Hasura-User-Id');
  });

  test('objects render as JSON (avoids "[object Object]")', () => {
    expect(formatPresetForInput({})).toBe('{}');
    expect(formatPresetForInput({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(formatPresetForInput([1, 2])).toBe('[1,2]');
  });
});
