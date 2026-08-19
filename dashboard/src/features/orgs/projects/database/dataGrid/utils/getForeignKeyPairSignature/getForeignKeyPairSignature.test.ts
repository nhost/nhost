import getForeignKeyPairSignature from './getForeignKeyPairSignature';

describe('getForeignKeyPairSignature', () => {
  test('builds a collision-safe signature for a single-column foreign key', () => {
    expect(getForeignKeyPairSignature(['user_id'], ['id'])).toBe(
      '[["user_id","id"]]',
    );
  });

  test('is insensitive to the order the pairs are declared in', () => {
    expect(getForeignKeyPairSignature(['a', 'b'], ['x', 'y'])).toBe(
      getForeignKeyPairSignature(['b', 'a'], ['y', 'x']),
    );
  });

  test('distinguishes different pairings of the same columns', () => {
    expect(getForeignKeyPairSignature(['a', 'b'], ['x', 'y'])).not.toBe(
      getForeignKeyPairSignature(['a', 'b'], ['y', 'x']),
    );
  });

  test('distinguishes different column sets', () => {
    expect(getForeignKeyPairSignature(['a', 'b'], ['x', 'y'])).not.toBe(
      getForeignKeyPairSignature(['a', 'c'], ['x', 'y']),
    );
  });

  test.each([
    { columns: [], referencedColumns: [] },
    { columns: ['a', 'b'], referencedColumns: ['x'] },
    { columns: ['a', 'a'], referencedColumns: ['x', 'y'] },
    { columns: ['a', 'b'], referencedColumns: ['x', 'x'] },
    { columns: ['a', ''], referencedColumns: ['x', 'y'] },
  ])('rejects incomplete or ambiguous mappings: $columns -> $referencedColumns', ({
    columns,
    referencedColumns,
  }) => {
    expect(getForeignKeyPairSignature(columns, referencedColumns)).toBeNull();
  });

  test('does not collide when identifiers contain former delimiter characters', () => {
    expect(getForeignKeyPairSignature(['a→b', 'c'], ['d', 'e|f'])).not.toBe(
      getForeignKeyPairSignature(['a', 'b→c'], ['d|e', 'f']),
    );
  });
});
