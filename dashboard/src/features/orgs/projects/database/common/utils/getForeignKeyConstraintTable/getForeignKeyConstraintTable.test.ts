import { getForeignKeyConstraintTable } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintTable';
import type {
  ForeignKeyConstraintOn,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

describe('getForeignKeyConstraintTable', () => {
  it.each([
    [
      'remote table with one column',
      { table: { schema: 'public', name: 'posts' }, column: 'author_id' },
      { schema: 'public', name: 'posts' },
    ],
    [
      'remote table with composite columns',
      {
        table: { schema: 'public', name: 'order_items' },
        columns: ['tenant_id', 'order_id'],
      },
      { schema: 'public', name: 'order_items' },
    ],
  ] satisfies [string, ForeignKeyConstraintOn, QualifiedTable][])(
    'reads the table of a %s constraint',
    (_name, constraint, expected) => {
      expect(getForeignKeyConstraintTable(constraint)).toEqual(expected);
    },
  );

  it.each([
    ['undefined constraint', undefined],
    ['same table with one column', 'author_id'],
    ['same table with composite columns', ['tenant_id', 'order_id']],
    ['remote table without a table', { column: 'author_id' }],
  ] satisfies [string, ForeignKeyConstraintOn | undefined][])(
    'returns undefined for a %s',
    (_name, constraint) => {
      expect(getForeignKeyConstraintTable(constraint)).toBeUndefined();
    },
  );
});
