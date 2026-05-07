import { buildSchema, type GraphQLInputField } from 'graphql';
import stringifyGraphQLValue from './stringifyGraphQLValue';

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
      idRequired: ID!
      uidRequired: UUID!
    ): String
  }
`);

function arg(name: string): GraphQLInputField {
  const queryType = schema.getQueryType();
  const field = queryType?.getFields().test;
  const found = field?.args.find((a) => a.name === name);
  if (!found) {
    throw new Error(`Could not find arg ${name} in test schema`);
  }
  return found as GraphQLInputField;
}

test('Boolean: real boolean true is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: true, arg: arg('flag') })).toBe(
    'true',
  );
});

test('Boolean: real boolean false is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: false, arg: arg('flag') })).toBe(
    'false',
  );
});

test('Boolean: string "true" is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: 'true', arg: arg('flag') })).toBe(
    'true',
  );
});

test('Boolean: string "false" is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: 'false', arg: arg('flag') })).toBe(
    'false',
  );
});

test('Boolean: session variable stays quoted', () => {
  expect(
    stringifyGraphQLValue({
      argName: 'X-Hasura-User-Verified',
      arg: arg('flag'),
    }),
  ).toBe('"X-Hasura-User-Verified"');
});

test('Boolean: arbitrary string falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: 'maybe', arg: arg('flag') })).toBe(
    '"maybe"',
  );
});

test('Int: real number is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: 5431, arg: arg('count') })).toBe(
    '5431',
  );
});

test('Int: numeric string is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: '5431', arg: arg('count') })).toBe(
    '5431',
  );
});

test('Int: zero is preserved (not dropped as falsy)', () => {
  expect(stringifyGraphQLValue({ argName: 0, arg: arg('count') })).toBe('0');
  expect(stringifyGraphQLValue({ argName: '0', arg: arg('count') })).toBe('0');
});

test('Int: leading zeros are canonicalized', () => {
  expect(stringifyGraphQLValue({ argName: '05431', arg: arg('count') })).toBe(
    '5431',
  );
});

test('Int: non-integer string falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: '3.14', arg: arg('count') })).toBe(
    '"3.14"',
  );
});

test('Int: empty string falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: '', arg: arg('count') })).toBe('""');
});

test('Int: whitespace string falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: '  ', arg: arg('count') })).toBe(
    '"  "',
  );
});

test('Float: empty string falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: '', arg: arg('pi') })).toBe('""');
});

test('Int: session variable stays quoted', () => {
  expect(
    stringifyGraphQLValue({ argName: 'X-Hasura-Org-Id', arg: arg('count') }),
  ).toBe('"X-Hasura-Org-Id"');
});

test('Float: numeric string with decimal is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: '3.14', arg: arg('pi') })).toBe(
    '3.14',
  );
});

test('Float: integer string is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: '3', arg: arg('pi') })).toBe('3');
});

test('Float: real number is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: 3.14, arg: arg('pi') })).toBe('3.14');
});

test('String: plain text is quoted', () => {
  expect(stringifyGraphQLValue({ argName: 'hello', arg: arg('name') })).toBe(
    '"hello"',
  );
});

test('String: session variable is quoted', () => {
  expect(
    stringifyGraphQLValue({ argName: 'X-Hasura-User-Id', arg: arg('name') }),
  ).toBe('"X-Hasura-User-Id"');
});

test('ID: value is quoted', () => {
  expect(stringifyGraphQLValue({ argName: 'abc-123', arg: arg('id') })).toBe(
    '"abc-123"',
  );
});

test('Enum: value is unquoted', () => {
  expect(stringifyGraphQLValue({ argName: 'ADMIN', arg: arg('role') })).toBe(
    'ADMIN',
  );
});

test('Enum: session variable stays quoted', () => {
  expect(
    stringifyGraphQLValue({ argName: 'X-Hasura-Role', arg: arg('role') }),
  ).toBe('"X-Hasura-Role"');
});

test('Custom scalar (UUID): value is quoted', () => {
  expect(
    stringifyGraphQLValue({
      argName: '00000000-0000-0000-0000-000000000000',
      arg: arg('uid'),
    }),
  ).toBe('"00000000-0000-0000-0000-000000000000"');
});

test('null on Boolean field: emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('flag') })).toBe(
    'null',
  );
});

test('null on Int field: emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('count') })).toBe(
    'null',
  );
});

test('null on Float field: emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('pi') })).toBe('null');
});

test('null on Enum field: emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('role') })).toBe(
    'null',
  );
});

test('null on nullable String field: emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('name') })).toBe(
    'null',
  );
});

test('null on nullable ID field: emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('id') })).toBe('null');
});

test('null on nullable custom scalar (UUID): emitted as unquoted null literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('uid') })).toBe(
    'null',
  );
});

test('null on non-null String field: emitted as quoted "null" literal', () => {
  expect(
    stringifyGraphQLValue({ argName: null, arg: arg('nameRequired') }),
  ).toBe('"null"');
});

test('null on non-null ID field: emitted as quoted "null" literal', () => {
  expect(stringifyGraphQLValue({ argName: null, arg: arg('idRequired') })).toBe(
    '"null"',
  );
});

test('null on non-null custom scalar: emitted as quoted "null" literal', () => {
  expect(
    stringifyGraphQLValue({ argName: null, arg: arg('uidRequired') }),
  ).toBe('"null"');
});

test('Real boolean on String field falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: true, arg: arg('name') })).toBe(
    '"true"',
  );
  expect(stringifyGraphQLValue({ argName: false, arg: arg('name') })).toBe(
    '"false"',
  );
});

test('Real boolean on Int field falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: true, arg: arg('count') })).toBe(
    '"true"',
  );
});

test('Real number on String field falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: 42, arg: arg('name') })).toBe('"42"');
});

test('Real number on Boolean field falls back to quoted', () => {
  expect(stringifyGraphQLValue({ argName: 42, arg: arg('flag') })).toBe('"42"');
});
