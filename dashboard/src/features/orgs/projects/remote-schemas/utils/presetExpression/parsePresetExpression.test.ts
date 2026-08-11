import { buildSchema, type GraphQLArgument } from 'graphql';
import parsePresetExpression from './parsePresetExpression';

const schema = buildSchema(`
  enum Role {
    ADMIN
    USER
  }
  scalar UUID
  input WhereInput {
    foo: String
    bar: Int
  }
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
      where: WhereInput
      whereRequired: WhereInput!
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
  it('null on any arg type yields a NullExpression', () => {
    expect(parsePresetExpression(null, argType('flag'))).toEqual({
      kind: 'null',
    });
    expect(parsePresetExpression(null, argType('name'))).toEqual({
      kind: 'null',
    });
    expect(parsePresetExpression(null, argType('nameRequired'))).toEqual({
      kind: 'null',
    });
  });
});

describe('boolean', () => {
  it('real true/false on Boolean field', () => {
    expect(parsePresetExpression(true, argType('flag'))).toEqual({
      kind: 'boolean',
      value: true,
    });
    expect(parsePresetExpression(false, argType('flag'))).toEqual({
      kind: 'boolean',
      value: false,
    });
  });

  it('string "true"/"false" on Boolean field', () => {
    expect(parsePresetExpression('true', argType('flag'))).toEqual({
      kind: 'boolean',
      value: true,
    });
    expect(parsePresetExpression('false', argType('flag'))).toEqual({
      kind: 'boolean',
      value: false,
    });
  });

  it('arbitrary string on Boolean field falls back to string', () => {
    expect(parsePresetExpression('maybe', argType('flag'))).toEqual({
      kind: 'string',
      value: 'maybe',
    });
  });

  it('real boolean on a non-Boolean field falls back to string', () => {
    expect(parsePresetExpression(true, argType('name'))).toEqual({
      kind: 'string',
      value: 'true',
    });
    expect(parsePresetExpression(true, argType('count'))).toEqual({
      kind: 'string',
      value: 'true',
    });
  });
});

describe('number', () => {
  it('real numbers on Int / Float', () => {
    expect(parsePresetExpression(5431, argType('count'))).toEqual({
      kind: 'number',
      value: 5431,
    });
    expect(parsePresetExpression(0, argType('count'))).toEqual({
      kind: 'number',
      value: 0,
    });
    expect(parsePresetExpression(3.14, argType('pi'))).toEqual({
      kind: 'number',
      value: 3.14,
    });
  });

  it('numeric strings on Int canonicalize', () => {
    expect(parsePresetExpression('5431', argType('count'))).toEqual({
      kind: 'number',
      value: 5431,
    });
    expect(parsePresetExpression('05431', argType('count'))).toEqual({
      kind: 'number',
      value: 5431,
    });
    expect(parsePresetExpression('0', argType('count'))).toEqual({
      kind: 'number',
      value: 0,
    });
  });

  it('non-integer string on Int falls back to string', () => {
    expect(parsePresetExpression('3.14', argType('count'))).toEqual({
      kind: 'string',
      value: '3.14',
    });
  });

  it('empty / whitespace string on numeric arg falls back to string', () => {
    expect(parsePresetExpression('', argType('count'))).toEqual({
      kind: 'string',
      value: '',
    });
    expect(parsePresetExpression('  ', argType('count'))).toEqual({
      kind: 'string',
      value: '  ',
    });
    expect(parsePresetExpression('', argType('pi'))).toEqual({
      kind: 'string',
      value: '',
    });
  });

  it('real number on String / Boolean field falls back to string', () => {
    expect(parsePresetExpression(42, argType('name'))).toEqual({
      kind: 'string',
      value: '42',
    });
    expect(parsePresetExpression(42, argType('flag'))).toEqual({
      kind: 'string',
      value: '42',
    });
  });
});

describe('enum', () => {
  it('string on enum field', () => {
    expect(parsePresetExpression('ADMIN', argType('role'))).toEqual({
      kind: 'enum',
      value: 'ADMIN',
    });
  });

  it('string on non-enum field is not classified as enum', () => {
    expect(parsePresetExpression('ADMIN', argType('name'))).toEqual({
      kind: 'string',
      value: 'ADMIN',
    });
  });
});

describe('sessionVariable', () => {
  it('detected on any arg type', () => {
    expect(parsePresetExpression('X-Hasura-User-Id', argType('name'))).toEqual({
      kind: 'sessionVariable',
      key: 'X-Hasura-User-Id',
    });
    expect(
      parsePresetExpression('X-Hasura-User-Verified', argType('flag')),
    ).toEqual({ kind: 'sessionVariable', key: 'X-Hasura-User-Verified' });
    expect(parsePresetExpression('X-Hasura-Org-Id', argType('count'))).toEqual({
      kind: 'sessionVariable',
      key: 'X-Hasura-Org-Id',
    });
    expect(parsePresetExpression('X-Hasura-Role', argType('role'))).toEqual({
      kind: 'sessionVariable',
      key: 'X-Hasura-Role',
    });
  });

  it('case-insensitive prefix match', () => {
    expect(parsePresetExpression('x-hasura-user-id', argType('name'))).toEqual({
      kind: 'sessionVariable',
      key: 'x-hasura-user-id',
    });
  });
});

describe('string fallback', () => {
  it('plain text on String', () => {
    expect(parsePresetExpression('hello', argType('name'))).toEqual({
      kind: 'string',
      value: 'hello',
    });
  });

  it('value on ID', () => {
    expect(parsePresetExpression('abc-123', argType('id'))).toEqual({
      kind: 'string',
      value: 'abc-123',
    });
  });

  it('value on custom scalar (UUID)', () => {
    expect(
      parsePresetExpression(
        '00000000-0000-0000-0000-000000000000',
        argType('uid'),
      ),
    ).toEqual({
      kind: 'string',
      value: '00000000-0000-0000-0000-000000000000',
    });
  });
});

describe('list', () => {
  it('array of strings on [Role!] classifies items as enum', () => {
    expect(parsePresetExpression(['ADMIN', 'USER'], argType('roles'))).toEqual({
      kind: 'list',
      items: [
        { kind: 'enum', value: 'ADMIN' },
        { kind: 'enum', value: 'USER' },
      ],
    });
  });

  it('empty array on [Role!]', () => {
    expect(parsePresetExpression([], argType('roles'))).toEqual({
      kind: 'list',
      items: [],
    });
  });

  it('JSON-array-literal string on a list-typed arg is parsed eagerly', () => {
    expect(parsePresetExpression('["a", "b"]', argType('roles'))).toEqual({
      kind: 'list',
      items: [
        { kind: 'enum', value: 'a' },
        { kind: 'enum', value: 'b' },
      ],
    });
  });

  it('non-JSON list-like string (e.g. "[a, b]") on [String!] falls back to string', () => {
    expect(parsePresetExpression('[a, b]', argType('tags'))).toEqual({
      kind: 'string',
      value: '[a, b]',
    });
  });

  it('JSON-array-literal string on a non-list arg is not parsed', () => {
    expect(parsePresetExpression('[1, 2]', argType('name'))).toEqual({
      kind: 'string',
      value: '[1, 2]',
    });
  });
});

describe('object', () => {
  it('plain object becomes an ObjectExpression', () => {
    expect(parsePresetExpression({ a: 1 }, argType('name'))).toEqual({
      kind: 'object',
      entries: { a: 1 },
    });
  });
});

describe('input object', () => {
  it('JSON-object string on nullable input-object arg is hydrated', () => {
    expect(
      parsePresetExpression('{"foo":"hello","bar":1}', argType('where')),
    ).toEqual({
      kind: 'object',
      entries: { foo: 'hello', bar: 1 },
    });
  });

  it('JSON-object string on non-null input-object arg is also hydrated', () => {
    expect(
      parsePresetExpression('{"foo":"x"}', argType('whereRequired')),
    ).toEqual({
      kind: 'object',
      entries: { foo: 'x' },
    });
  });

  it('non-JSON string on input-object arg falls back to string', () => {
    expect(parsePresetExpression('hello', argType('where'))).toEqual({
      kind: 'string',
      value: 'hello',
    });
  });

  it('JSON-array string on input-object arg is not hydrated as object', () => {
    expect(parsePresetExpression('[1, 2]', argType('where'))).toEqual({
      kind: 'string',
      value: '[1, 2]',
    });
  });

  it('real object on input-object arg passes through as object', () => {
    expect(parsePresetExpression({ foo: 'x' }, argType('where'))).toEqual({
      kind: 'object',
      entries: { foo: 'x' },
    });
  });

  it('JSON-object string on a non-input-object arg is not hydrated', () => {
    expect(parsePresetExpression('{"foo":1}', argType('name'))).toEqual({
      kind: 'string',
      value: '{"foo":1}',
    });
  });
});
