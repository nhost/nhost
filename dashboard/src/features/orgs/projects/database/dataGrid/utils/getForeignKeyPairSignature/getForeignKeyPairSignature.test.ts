import { describe, expect, test } from 'vitest';
import getForeignKeyPairSignature from './getForeignKeyPairSignature';

describe('getForeignKeyPairSignature', () => {
  test('builds a signature for a single-column foreign key', () => {
    expect(getForeignKeyPairSignature(['user_id'], ['id'])).toBe('user_id→id');
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

  test('handles a missing referenced column without throwing', () => {
    expect(getForeignKeyPairSignature(['a', 'b'], ['x'])).toBe('a→x|b→');
  });
});
