import { computeForeignKeyOneToOne } from './index';

describe('computeForeignKeyOneToOne', () => {
  it('returns true for a composite foreign key matching a non-primary unique set', () => {
    expect(
      computeForeignKeyOneToOne(['a', 'b'], {
        columns: [{ name: 'a' }, { name: 'b' }],
        constraintColumnSets: [['a', 'b']],
      }),
    ).toBe(true);
  });

  it('matches the constraint set regardless of column order', () => {
    expect(
      computeForeignKeyOneToOne(['b', 'a'], {
        columns: [{ name: 'a' }, { name: 'b' }],
        constraintColumnSets: [['a', 'b']],
      }),
    ).toBe(true);
  });

  it('returns false for a composite foreign key with no covering set', () => {
    expect(
      computeForeignKeyOneToOne(['a', 'b'], {
        columns: [{ name: 'a' }, { name: 'b' }],
        constraintColumnSets: [['a']],
      }),
    ).toBe(false);
  });

  it('returns true for a composite foreign key matching the primary key set', () => {
    expect(
      computeForeignKeyOneToOne(['a', 'b'], {
        columns: [
          { name: 'a', isPrimary: true },
          { name: 'b', isPrimary: true },
        ],
      }),
    ).toBe(true);
  });

  it('derives the primary key set from per-column flags when no constraint sets are provided', () => {
    expect(
      computeForeignKeyOneToOne(['a', 'b'], {
        columns: [
          { name: 'a', isPrimary: true },
          { name: 'b', isPrimary: true },
          { name: 'c' },
        ],
      }),
    ).toBe(true);
  });

  it('returns true for a single primary column', () => {
    expect(
      computeForeignKeyOneToOne(['id'], {
        columns: [{ name: 'id', isPrimary: true }],
      }),
    ).toBe(true);
  });

  it('returns true for a single unique column', () => {
    expect(
      computeForeignKeyOneToOne(['email'], {
        columns: [{ name: 'email', isUnique: true }],
      }),
    ).toBe(true);
  });

  it('returns false for a single column that is neither unique nor primary', () => {
    expect(
      computeForeignKeyOneToOne(['author_id'], {
        columns: [{ name: 'author_id' }],
      }),
    ).toBe(false);
  });

  it('returns false for a single column that is only part of a composite primary key', () => {
    expect(
      computeForeignKeyOneToOne(['user_id'], {
        columns: [
          { name: 'user_id', isPrimary: true },
          { name: 'team_id', isPrimary: true },
        ],
      }),
    ).toBe(false);
  });

  it('returns false for a single column that is only part of a composite unique constraint', () => {
    expect(
      computeForeignKeyOneToOne(['a'], {
        columns: [{ name: 'a' }, { name: 'b' }],
        constraintColumnSets: [['a', 'b']],
      }),
    ).toBe(false);
  });

  it('returns false for an empty foreign key column list', () => {
    expect(
      computeForeignKeyOneToOne([], {
        columns: [{ name: 'a', isPrimary: true }],
      }),
    ).toBe(false);
  });

  it('does not match an empty constraint set', () => {
    expect(
      computeForeignKeyOneToOne(['a'], {
        columns: [{ name: 'a' }],
        constraintColumnSets: [[]],
      }),
    ).toBe(false);
  });
});
