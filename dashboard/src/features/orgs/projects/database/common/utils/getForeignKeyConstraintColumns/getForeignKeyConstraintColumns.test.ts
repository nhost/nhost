import { getForeignKeyConstraintColumns } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintColumns';

const posts = { schema: 'public', name: 'posts' };

describe('getForeignKeyConstraintColumns', () => {
  it('reads a column on the same table', () => {
    expect(getForeignKeyConstraintColumns('author_id')).toEqual(['author_id']);
  });

  it('reads composite columns on the same table', () => {
    expect(getForeignKeyConstraintColumns(['tenant_id', 'order_id'])).toEqual([
      'tenant_id',
      'order_id',
    ]);
  });

  it('reads a column on another table', () => {
    expect(
      getForeignKeyConstraintColumns({ table: posts, column: 'author_id' }),
    ).toEqual(['author_id']);
  });

  it('reads composite columns on another table', () => {
    expect(
      getForeignKeyConstraintColumns({
        table: posts,
        columns: ['tenant_id', 'order_id'],
      }),
    ).toEqual(['tenant_id', 'order_id']);
  });

  it('returns an empty list when a constraint on another table has no columns', () => {
    expect(getForeignKeyConstraintColumns({ table: posts })).toEqual([]);
  });

  it('reads a column named "null" on another table', () => {
    expect(
      getForeignKeyConstraintColumns({ table: posts, column: 'null' }),
    ).toEqual(['null']);
  });
});
