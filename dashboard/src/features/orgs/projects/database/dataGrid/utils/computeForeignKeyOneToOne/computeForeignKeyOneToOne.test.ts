import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';

describe('computeForeignKeyOneToOne', () => {
  it('matches complete candidate sets regardless of order', () => {
    expect(
      computeForeignKeyOneToOne(
        ['account_id', 'tenant_id'],
        [['tenant_id', 'account_id']],
      ),
    ).toBe(true);
  });

  it('recognizes a candidate key contained within the foreign key', () => {
    expect(
      computeForeignKeyOneToOne(
        ['tenant_id', 'account_id', 'region_id'],
        [['tenant_id', 'account_id']],
      ),
    ).toBe(true);
  });

  it.each([
    {
      name: 'foreign-key subset',
      foreignKey: ['tenant_id'],
      candidates: [['tenant_id', 'account_id']],
    },
    {
      name: 'duplicate foreign-key member',
      foreignKey: ['tenant_id', 'tenant_id'],
      candidates: [['tenant_id']],
    },
  ])('rejects a non-qualifying $name match', ({ foreignKey, candidates }) => {
    expect(computeForeignKeyOneToOne(foreignKey, candidates)).toBe(false);
  });
});
