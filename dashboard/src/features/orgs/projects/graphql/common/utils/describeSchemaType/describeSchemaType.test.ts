import { buildSchema, type GraphQLNamedType } from 'graphql';
import { describe, expect, it } from 'vitest';
import { getDocsKind, getMemberCount } from './describeSchemaType';

const schema = buildSchema(`
  type users {
    id: ID!
    email: String
  }

  type users_aggregate {
    count: Int!
  }

  enum order_by {
    asc
    desc
  }

  input users_bool_exp {
    id: ID
  }

  scalar uuid

  type Query {
    users: [users!]!
  }
`);

const type = (name: string) => schema.getType(name) as GraphQLNamedType;

describe('getMemberCount', () => {
  it('counts fields, values and nothing for scalars', () => {
    expect(getMemberCount(type('users'))).toBe('2 fields');
    expect(getMemberCount(type('users_aggregate'))).toBe('1 field');
    expect(getMemberCount(type('order_by'))).toBe('2 values');
    expect(getMemberCount(type('uuid'))).toBeNull();
  });
});

describe('getDocsKind', () => {
  it('tells roots, tables, inputs, enums, scalars and fields apart', () => {
    expect(getDocsKind(type('Query'), schema)).toBe('root');
    expect(getDocsKind(type('users'), schema)).toBe('table');
    expect(getDocsKind(type('users_aggregate'), schema)).toBe('type');
    expect(getDocsKind(type('users_bool_exp'), schema)).toBe('input');
    expect(getDocsKind(type('order_by'), schema)).toBe('enum');
    expect(getDocsKind(type('uuid'), schema)).toBe('scalar');
    expect(getDocsKind(schema.getQueryType()?.getFields().users, schema)).toBe(
      'field',
    );
  });
});
