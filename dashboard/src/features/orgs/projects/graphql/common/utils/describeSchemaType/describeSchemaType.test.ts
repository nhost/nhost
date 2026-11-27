import { buildSchema, type GraphQLNamedType } from 'graphql';
import { getMemberCount } from './describeSchemaType';

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
