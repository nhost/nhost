import getForeignKeyPairSignature from './getForeignKeyPairSignature';

describe('getForeignKeyPairSignature', () => {
  test('is insensitive to pair order but distinguishes crossed pairings', () => {
    expect(getForeignKeyPairSignature(['a', 'b'], ['x', 'y'])).toBe(
      getForeignKeyPairSignature(['b', 'a'], ['y', 'x']),
    );
    expect(getForeignKeyPairSignature(['a', 'b'], ['x', 'y'])).not.toBe(
      getForeignKeyPairSignature(['a', 'b'], ['y', 'x']),
    );
  });

  test.each([
    { columns: ['a', 'b'], referencedColumns: ['x'] },
    { columns: ['a', 'a'], referencedColumns: ['x', 'y'] },
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
