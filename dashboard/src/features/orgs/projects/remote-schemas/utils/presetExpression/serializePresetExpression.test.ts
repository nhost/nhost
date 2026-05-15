import { buildSchema, type GraphQLInputField } from 'graphql';
import serializePresetExpression from './serializePresetExpression';

const schema = buildSchema(`
  type Query {
    test(
      flag: Boolean
      name: String
      nameRequired: String!
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

it('null on nullable arg emits unquoted null', () => {
  expect(serializePresetExpression({ kind: 'null' }, arg('flag'))).toBe('null');
  expect(serializePresetExpression({ kind: 'null' }, arg('name'))).toBe('null');
});

it('null on non-null arg emits quoted "null"', () => {
  expect(serializePresetExpression({ kind: 'null' }, arg('nameRequired'))).toBe(
    '"null"',
  );
});

it('boolean emits unquoted literal', () => {
  expect(
    serializePresetExpression({ kind: 'boolean', value: true }, arg('flag')),
  ).toBe('true');
  expect(
    serializePresetExpression({ kind: 'boolean', value: false }, arg('flag')),
  ).toBe('false');
});

it('number emits unquoted literal', () => {
  expect(
    serializePresetExpression({ kind: 'number', value: 5431 }, arg('flag')),
  ).toBe('5431');
  expect(
    serializePresetExpression({ kind: 'number', value: 3.14 }, arg('flag')),
  ).toBe('3.14');
  expect(
    serializePresetExpression({ kind: 'number', value: 0 }, arg('flag')),
  ).toBe('0');
});

it('enum emits unquoted name', () => {
  expect(
    serializePresetExpression({ kind: 'enum', value: 'ADMIN' }, arg('name')),
  ).toBe('ADMIN');
});

it('sessionVariable emits quoted key', () => {
  expect(
    serializePresetExpression(
      { kind: 'sessionVariable', key: 'X-Hasura-User-Id' },
      arg('name'),
    ),
  ).toBe('"X-Hasura-User-Id"');
});

it('string emits quoted value', () => {
  expect(
    serializePresetExpression({ kind: 'string', value: 'hello' }, arg('name')),
  ).toBe('"hello"');
  expect(
    serializePresetExpression({ kind: 'string', value: '' }, arg('name')),
  ).toBe('""');
});

it('list serializes each item and wraps in brackets', () => {
  expect(
    serializePresetExpression(
      {
        kind: 'list',
        items: [
          { kind: 'enum', value: 'ADMIN' },
          { kind: 'enum', value: 'USER' },
        ],
      },
      arg('name'),
    ),
  ).toBe('[ADMIN,USER]');
});
