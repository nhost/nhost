import { buildSchema } from 'graphql';
import { groupSchemaTypes } from './SchemaTypeGroups';

const schema = buildSchema(`
  type buckets { id: String! }
  type buckets_aggregate { count: Int! }
  input buckets_bool_exp { id: String }
  type files { id: String! }
  type files_aggregate { count: Int! }
  type query_root {
    buckets(where: buckets_bool_exp): [buckets!]!
    buckets_aggregate: buckets_aggregate!
    files: [files!]!
    files_aggregate: files_aggregate!
  }
  schema { query: query_root }
`);

describe('groupSchemaTypes', () => {
  it('puts tables first, recognised by their aggregate type', () => {
    const { tables } = groupSchemaTypes(schema);

    expect(tables.map((type) => type.name)).toEqual(['buckets', 'files']);
  });

  it('keeps helper and scalar types in other types, without root types', () => {
    const names = groupSchemaTypes(schema).otherTypes.map((type) => type.name);

    expect(names).toContain('buckets_bool_exp');
    expect(names).toContain('buckets_aggregate');
    expect(names).toContain('String');
    expect(names).not.toContain('query_root');
    expect(names.some((name) => name.startsWith('__'))).toBe(false);
  });

  it('is empty without a schema', () => {
    expect(groupSchemaTypes(null)).toEqual({ tables: [], otherTypes: [] });
  });
});
