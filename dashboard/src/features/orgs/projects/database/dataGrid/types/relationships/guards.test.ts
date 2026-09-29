import { isFKConstraintOnSameTable } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';

describe('isFKConstraintOnSameTable', () => {
  it('accepts a column on the same table', () => {
    expect(isFKConstraintOnSameTable('author_id')).toBe(true);
  });

  it('accepts composite columns on the same table', () => {
    expect(isFKConstraintOnSameTable(['tenant_id', 'order_id'])).toBe(true);
  });

  it('rejects a constraint on another table', () => {
    expect(
      isFKConstraintOnSameTable({
        table: { schema: 'public', name: 'posts' },
        columns: ['tenant_id', 'order_id'],
      }),
    ).toBe(false);
  });

  it('rejects an undefined constraint', () => {
    expect(isFKConstraintOnSameTable(undefined)).toBe(false);
  });
});
