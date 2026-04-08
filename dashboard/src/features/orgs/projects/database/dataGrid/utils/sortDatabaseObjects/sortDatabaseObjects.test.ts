import { describe, expect, test } from 'vitest';
import type {
  DatabaseObjectViewModel,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import sortDatabaseObjects from './sortDatabaseObjects';

function obj(
  name: string,
  objectType: TableLikeObjectType,
  schema = 'public',
): DatabaseObjectViewModel {
  return { name, objectType, schema, updatability: 28 };
}

function fn(
  name: string,
  oid: string,
  schema = 'public',
): DatabaseObjectViewModel {
  return { name, objectType: 'FUNCTION', schema, oid };
}

describe('sortDatabaseObjects', () => {
  test('should sort all objects alphabetically regardless of type', () => {
    const input = [
      fn('search_users', '16384'),
      obj('users', 'ORDINARY TABLE'),
      obj('activity_log', 'VIEW'),
      obj('cached_stats', 'MATERIALIZED VIEW'),
      obj('external_data', 'FOREIGN TABLE'),
    ];

    const result = sortDatabaseObjects(input);

    expect(result.map((o) => o.name)).toEqual([
      'activity_log',
      'cached_stats',
      'external_data',
      'search_users',
      'users',
    ]);
  });

  test('should sort alphabetically within mixed types', () => {
    const input = [
      obj('zebra', 'VIEW'),
      fn('alpha', '1'),
      obj('middle', 'ORDINARY TABLE'),
    ];

    const result = sortDatabaseObjects(input);

    expect(result.map((o) => o.name)).toEqual(['alpha', 'middle', 'zebra']);
  });

  test('should not mutate the original array', () => {
    const input = [obj('b_view', 'VIEW'), obj('a_table', 'ORDINARY TABLE')];
    const original = [...input];

    sortDatabaseObjects(input);

    expect(input).toEqual(original);
  });

  test('should handle an empty array', () => {
    expect(sortDatabaseObjects([])).toEqual([]);
  });
});
