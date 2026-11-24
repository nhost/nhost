import { buildSchema } from 'graphql';
import {
  groupSchemaTypes,
  isTableType,
} from '@/features/orgs/projects/graphql/common/utils/groupSchemaTypes';

const schema = buildSchema(`
  type buckets { id: String! }
  type buckets_aggregate { count: Int! }
  input buckets_bool_exp { id: String }
  input buckets_aggregate_bool_exp { count: Int }
  type files { id: String! }
  input files_bool_exp { id: String }
  type Post { title: String! }
  type query_root {
    buckets(where: buckets_bool_exp): [buckets!]!
    buckets_aggregate(where: buckets_bool_exp): buckets_aggregate!
    files(where: files_bool_exp): [files!]!
    posts: [Post!]!
  }
  schema { query: query_root }
`);

describe('groupSchemaTypes', () => {
  it('puts tables first, recognised by their list root field and filter input', () => {
    const { tables } = groupSchemaTypes(schema);

    expect(tables.map((type) => type.name)).toEqual(['buckets', 'files']);
  });

  it('keeps helper and scalar types in other types, without root types', () => {
    const names = groupSchemaTypes(schema).otherTypes.map((type) => type.name);

    expect(names).toContain('buckets_bool_exp');
    expect(names).toContain('buckets_aggregate');
    expect(names).toContain('Post');
    expect(names).toContain('String');
    expect(names).not.toContain('query_root');
    expect(names.some((name) => name.startsWith('__'))).toBe(false);
  });

  it('is empty without a schema', () => {
    expect(groupSchemaTypes(null)).toEqual({ tables: [], otherTypes: [] });
  });
});

describe('isTableType', () => {
  it('finds a table without an aggregate type, as for a role without aggregations', () => {
    expect(isTableType(schema, schema.getType('files')!)).toBe(true);
  });

  it('skips aggregate types, even with a matching filter input', () => {
    expect(isTableType(schema, schema.getType('buckets_aggregate')!)).toBe(
      false,
    );
  });

  it('skips a listed type without a filter input, like a remote schema type', () => {
    expect(isTableType(schema, schema.getType('Post')!)).toBe(false);
  });
});
