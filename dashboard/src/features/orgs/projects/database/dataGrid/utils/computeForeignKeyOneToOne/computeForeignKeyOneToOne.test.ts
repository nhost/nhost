import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';

describe('computeForeignKeyOneToOne', () => {
  it('matches complete candidate sets regardless of order', () => {
    expect(
      computeForeignKeyOneToOne(['account_id', 'tenant_id'], {
        constraintColumnSets: [['tenant_id', 'account_id']],
      }),
    ).toBe(true);
  });

  it('recognizes a candidate key contained within the foreign key', () => {
    expect(
      computeForeignKeyOneToOne(['tenant_id', 'account_id', 'region_id'], {
        constraintColumnSets: [['tenant_id', 'account_id']],
      }),
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
    {
      name: 'duplicate candidate member',
      foreignKey: ['tenant_id'],
      candidates: [['tenant_id', 'tenant_id']],
    },
    { name: 'empty foreign key', foreignKey: [], candidates: [['id']] },
    { name: 'empty candidate', foreignKey: ['id'], candidates: [[]] },
  ])('rejects a non-qualifying $name match', ({ foreignKey, candidates }) => {
    expect(
      computeForeignKeyOneToOne(foreignKey, {
        constraintColumnSets: candidates,
      }),
    ).toBe(false);
  });

  it('derives the complete primary key set for unsaved forms', () => {
    expect(
      computeForeignKeyOneToOne(['tenant_id', 'account_id'], {
        columns: [
          { name: 'tenant_id', isPrimary: true },
          { name: 'account_id', isPrimary: true },
        ],
      }),
    ).toBe(true);
    expect(
      computeForeignKeyOneToOne(['tenant_id'], {
        columns: [
          { name: 'tenant_id', isPrimary: true },
          { name: 'account_id', isPrimary: true },
        ],
      }),
    ).toBe(false);
  });
});
