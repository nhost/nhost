import { getForeignKeyConstraintColumns } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintColumns';
import type { ForeignKeyConstraintOn } from '@/utils/hasura-api/generated/schemas';

describe('getForeignKeyConstraintColumns', () => {
  it.each([
    ['object relationship with one column', 'author_id', ['author_id']],
    [
      'object relationship with composite columns',
      ['tenant_id', 'order_id'],
      ['tenant_id', 'order_id'],
    ],
    [
      'array relationship with one column',
      {
        table: { schema: 'public', name: 'posts' },
        column: 'author_id',
      },
      ['author_id'],
    ],
    [
      'array relationship with composite columns',
      {
        table: { schema: 'public', name: 'order_items' },
        columns: ['tenant_id', 'order_id'],
      },
      ['tenant_id', 'order_id'],
    ],
  ] satisfies [string, ForeignKeyConstraintOn, string[]][])(
    'reads an %s',
    (_name, constraint, expected) => {
      expect(getForeignKeyConstraintColumns(constraint)).toEqual(expected);
    },
  );

  it.each([
    ['missing column properties', {}],
    ['missing column value', { column: undefined }],
    ['missing columns value', { columns: undefined }],
    ['empty columns value', { columns: [] }],
  ] satisfies [string, ForeignKeyConstraintOn][])(
    'returns an empty list for an object with %s',
    (_name, constraint) => {
      expect(getForeignKeyConstraintColumns(constraint)).toEqual([]);
    },
  );

  // Test that columns named "null" (valid in Postgres) are returned verbatim
  it.each([
    ['a bare column', 'null', ['null']],
    ['a bare column list', ['null'], ['null']],
    [
      'a table qualified column',
      { table: { schema: 'public', name: 'posts' }, column: 'null' },
      ['null'],
    ],
    [
      'a table qualified column list',
      { table: { schema: 'public', name: 'posts' }, columns: ['null'] },
      ['null'],
    ],
  ] satisfies [string, ForeignKeyConstraintOn, string[]][])(
    'reads %s verbatim',
    (_name, constraint, expected) => {
      expect(getForeignKeyConstraintColumns(constraint)).toEqual(expected);
    },
  );
});
