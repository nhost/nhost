import { buildSchema, type GraphQLArgument } from 'graphql';
import parsePresetValue from './parsePresetValue';

const schema = buildSchema(`
  enum Role {
    ADMIN
    USER
  }
  scalar UUID
  type Query {
    test(
      flag: Boolean
      count: Int
      pi: Float
      name: String
      id: ID
      role: Role
      uid: UUID
      nameRequired: String!
      roles: [Role!]
      tags: [String!]
    ): String
  }
`);

function argType(name: string) {
  const queryType = schema.getQueryType();
  const field = queryType?.getFields().test;
  const found = field?.args.find((a: GraphQLArgument) => a.name === name);
  if (!found) {
    throw new Error(`Could not find arg ${name} in test schema`);
  }
  return found.type;
}

describe('null', () => {
  test('null on any arg type yields a NullExpression', () => {
    expect(parsePresetValue(null, argType('flag'))).toEqual({
      kind: 'null',
    });
    expect(parsePresetValue(null, argType('name'))).toEqual({
      kind: 'null',
    });
    expect(parsePresetValue(null, argType('nameRequired'))).toEqual({
      kind: 'null',
    });
  });
});

describe('boolean', () => {
  test('real true/false on Boolean field', () => {
    expect(parsePresetValue(true, argType('flag'))).toEqual({
      kind: 'boolean',
      value: true,
    });
    expect(parsePresetValue(false, argType('flag'))).toEqual({
      kind: 'boolean',
      value: false,
    });
  });

  test('string "true"/"false" on Boolean field', () => {
    expect(parsePresetValue('true', argType('flag'))).toEqual({
      kind: 'boolean',
      value: true,
    });
    expect(parsePresetValue('false', argType('flag'))).toEqual({
      kind: 'boolean',
      value: false,
    });
  });

  test('arbitrary string on Boolean field falls back to string', () => {
    expect(parsePresetValue('maybe', argType('flag'))).toEqual({
      kind: 'string',
      value: 'maybe',
    });
  });

  test('real boolean on a non-Boolean field falls back to string', () => {
    expect(parsePresetValue(true, argType('name'))).toEqual({
      kind: 'string',
      value: 'true',
    });
    expect(parsePresetValue(true, argType('count'))).toEqual({
      kind: 'string',
      value: 'true',
    });
  });
});

describe('number', () => {
  test('real numbers on Int / Float', () => {
    expect(parsePresetValue(5431, argType('count'))).toEqual({
      kind: 'number',
      value: 5431,
    });
    expect(parsePresetValue(0, argType('count'))).toEqual({
      kind: 'number',
      value: 0,
    });
    expect(parsePresetValue(3.14, argType('pi'))).toEqual({
      kind: 'number',
      value: 3.14,
    });
  });

  test('numeric strings on Int canonicalize', () => {
    expect(parsePresetValue('5431', argType('count'))).toEqual({
      kind: 'number',
      value: 5431,
    });
    expect(parsePresetValue('05431', argType('count'))).toEqual({
      kind: 'number',
      value: 5431,
    });
    expect(parsePresetValue('0', argType('count'))).toEqual({
      kind: 'number',
      value: 0,
    });
  });

  test('non-integer string on Int falls back to string', () => {
    expect(parsePresetValue('3.14', argType('count'))).toEqual({
      kind: 'string',
      value: '3.14',
    });
  });

  test('empty / whitespace string on numeric arg falls back to string', () => {
    expect(parsePresetValue('', argType('count'))).toEqual({
      kind: 'string',
      value: '',
    });
    expect(parsePresetValue('  ', argType('count'))).toEqual({
      kind: 'string',
      value: '  ',
    });
    expect(parsePresetValue('', argType('pi'))).toEqual({
      kind: 'string',
      value: '',
    });
  });

  test('real number on String / Boolean field falls back to string', () => {
    expect(parsePresetValue(42, argType('name'))).toEqual({
      kind: 'string',
      value: '42',
    });
    expect(parsePresetValue(42, argType('flag'))).toEqual({
      kind: 'string',
      value: '42',
    });
  });
});

describe('enum', () => {
  test('string on enum field', () => {
    expect(parsePresetValue('ADMIN', argType('role'))).toEqual({
      kind: 'enum',
      value: 'ADMIN',
    });
  });

  test('string on non-enum field is not classified as enum', () => {
    expect(parsePresetValue('ADMIN', argType('name'))).toEqual({
      kind: 'string',
      value: 'ADMIN',
    });
  });
});

describe('sessionVariable', () => {
  test('detected on any arg type', () => {
    expect(parsePresetValue('X-Hasura-User-Id', argType('name'))).toEqual({
      kind: 'sessionVariable',
      key: 'X-Hasura-User-Id',
    });
    expect(parsePresetValue('X-Hasura-User-Verified', argType('flag'))).toEqual(
      { kind: 'sessionVariable', key: 'X-Hasura-User-Verified' },
    );
    expect(parsePresetValue('X-Hasura-Org-Id', argType('count'))).toEqual({
      kind: 'sessionVariable',
      key: 'X-Hasura-Org-Id',
    });
    expect(parsePresetValue('X-Hasura-Role', argType('role'))).toEqual({
      kind: 'sessionVariable',
      key: 'X-Hasura-Role',
    });
  });

  test('case-insensitive prefix match', () => {
    expect(parsePresetValue('x-hasura-user-id', argType('name'))).toEqual({
      kind: 'sessionVariable',
      key: 'x-hasura-user-id',
    });
  });
});

describe('string fallback', () => {
  test('plain text on String', () => {
    expect(parsePresetValue('hello', argType('name'))).toEqual({
      kind: 'string',
      value: 'hello',
    });
  });

  test('value on ID', () => {
    expect(parsePresetValue('abc-123', argType('id'))).toEqual({
      kind: 'string',
      value: 'abc-123',
    });
  });

  test('value on custom scalar (UUID)', () => {
    expect(
      parsePresetValue('00000000-0000-0000-0000-000000000000', argType('uid')),
    ).toEqual({
      kind: 'string',
      value: '00000000-0000-0000-0000-000000000000',
    });
  });
});

describe('list', () => {
  test('array of strings on [Role!] classifies items as enum', () => {
    expect(parsePresetValue(['ADMIN', 'USER'], argType('roles'))).toEqual({
      kind: 'list',
      items: [
        { kind: 'enum', value: 'ADMIN' },
        { kind: 'enum', value: 'USER' },
      ],
    });
  });

  test('empty array on [Role!]', () => {
    expect(parsePresetValue([], argType('roles'))).toEqual({
      kind: 'list',
      items: [],
    });
  });

  test('JSON-array-literal string on a list-typed arg is parsed eagerly', () => {
    expect(parsePresetValue('["a", "b"]', argType('roles'))).toEqual({
      kind: 'list',
      items: [
        { kind: 'enum', value: 'a' },
        { kind: 'enum', value: 'b' },
      ],
    });
  });

  test('non-JSON list-like string (e.g. "[a, b]") on [String!] falls back to string', () => {
    expect(parsePresetValue('[a, b]', argType('tags'))).toEqual({
      kind: 'string',
      value: '[a, b]',
    });
  });

  test('JSON-array-literal string on a non-list arg is not parsed', () => {
    expect(parsePresetValue('[1, 2]', argType('name'))).toEqual({
      kind: 'string',
      value: '[1, 2]',
    });
  });
});

describe('object', () => {
  test('plain object becomes an ObjectExpression', () => {
    expect(parsePresetValue({ a: 1 }, argType('name'))).toEqual({
      kind: 'object',
      entries: { a: 1 },
    });
  });
});
