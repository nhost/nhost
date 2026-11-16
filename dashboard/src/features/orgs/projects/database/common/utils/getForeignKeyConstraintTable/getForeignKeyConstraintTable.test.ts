import { getForeignKeyConstraintTable } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintTable';

describe('getForeignKeyConstraintTable', () => {
  it('reads the table of a constraint on another table', () => {
    expect(
      getForeignKeyConstraintTable({
        table: { schema: 'public', name: 'order_items' },
        columns: ['tenant_id', 'order_id'],
      }),
    ).toEqual({ schema: 'public', name: 'order_items' });
  });

  it('returns undefined for a constraint on the same table', () => {
    expect(getForeignKeyConstraintTable('author_id')).toBeUndefined();
    expect(
      getForeignKeyConstraintTable(['tenant_id', 'order_id']),
    ).toBeUndefined();
  });

  it('returns undefined for an undefined constraint', () => {
    expect(getForeignKeyConstraintTable(undefined)).toBeUndefined();
  });
});
