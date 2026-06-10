import { areStrArraysEqual } from '@/lib/utils';
import { computeForeignKeyOneToOne, deriveConstraintColumnSets } from './index';

describe('deriveConstraintColumnSets', () => {
  it('groups columns sharing a composite unique constraint into one set', () => {
    const sets = deriveConstraintColumnSets([
      { name: 'a', uniqueConstraints: ['child_a_b_key'] },
      { name: 'b', uniqueConstraints: ['child_a_b_key'] },
    ]);

    expect(sets).toHaveLength(1);
    expect(areStrArraysEqual(sets[0], ['a', 'b'])).toBe(true);
  });

  it('produces one set per distinct constraint name', () => {
    const sets = deriveConstraintColumnSets([
      { name: 'id', primaryConstraints: ['child_pkey'] },
      { name: 'email', uniqueConstraints: ['child_email_key'] },
    ]);

    expect(sets).toHaveLength(2);
    expect(sets.some((set) => areStrArraysEqual(set, ['id']))).toBe(true);
    expect(sets.some((set) => areStrArraysEqual(set, ['email']))).toBe(true);
  });

  it('returns an empty list when no columns carry constraint names', () => {
    expect(deriveConstraintColumnSets([{ name: 'a' }, { name: 'b' }])).toEqual(
      [],
    );
  });

  it('reconstructs a set that computeForeignKeyOneToOne treats as one-to-one', () => {
    const columns = [
      { name: 'a', uniqueConstraints: ['child_a_b_key'] },
      { name: 'b', uniqueConstraints: ['child_a_b_key'] },
    ];
    const constraintColumnSets = deriveConstraintColumnSets(columns);

    expect(
      computeForeignKeyOneToOne(['a', 'b'], { columns, constraintColumnSets }),
    ).toBe(true);
  });
});
