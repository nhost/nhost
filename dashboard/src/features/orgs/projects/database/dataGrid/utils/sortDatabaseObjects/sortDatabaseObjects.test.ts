import { describe, expect, test } from 'vitest';
import type {
  DatabaseObjectType,
  DatabaseObjectViewModel,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import sortDatabaseObjects from './sortDatabaseObjects';

function obj(
  name: string,
  objectType: DatabaseObjectType,
  schema = 'public',
): DatabaseObjectViewModel {
  return { name, objectType, schema, updatability: 28 };
}

describe('sortDatabaseObjects', () => {
  test('should sort all object types in the correct group order', () => {
    const input = [
      obj('d_view', 'VIEW'),
      obj('c_mat_view', 'MATERIALIZED VIEW'),
      obj('b_foreign', 'FOREIGN TABLE'),
      obj('a_table', 'ORDINARY TABLE'),
    ];

    const result = sortDatabaseObjects(input);

    expect(result.map((o) => o.objectType)).toEqual([
      'ORDINARY TABLE',
      'FOREIGN TABLE',
      'MATERIALIZED VIEW',
      'VIEW',
    ]);
  });

  test('should sort alphabetically within the same type group', () => {
    const input = [
      obj('zebra', 'ORDINARY TABLE'),
      obj('alpha', 'ORDINARY TABLE'),
      obj('middle', 'ORDINARY TABLE'),
    ];

    const result = sortDatabaseObjects(input);

    expect(result.map((o) => o.name)).toEqual(['alpha', 'middle', 'zebra']);
  });

  test('should place enum tables in their own group after ordinary tables', () => {
    const enums = new Set(['public.status_enum']);
    const input = [
      obj('status_enum', 'ORDINARY TABLE'),
      obj('users', 'ORDINARY TABLE'),
      obj('my_view', 'VIEW'),
    ];

    const result = sortDatabaseObjects(input, enums);

    expect(result.map((o) => o.name)).toEqual([
      'users',
      'status_enum',
      'my_view',
    ]);
  });

  test('should sort multiple enum tables alphabetically', () => {
    const enums = new Set(['public.status', 'public.priority']);
    const input = [
      obj('status', 'ORDINARY TABLE'),
      obj('priority', 'ORDINARY TABLE'),
      obj('users', 'ORDINARY TABLE'),
    ];

    const result = sortDatabaseObjects(input, enums);

    expect(result.map((o) => o.name)).toEqual(['users', 'priority', 'status']);
  });

  test('should use schema-qualified path for enum detection', () => {
    const enums = new Set(['other_schema.my_table']);
    const input = [
      obj('my_table', 'ORDINARY TABLE', 'public'),
      obj('my_table', 'ORDINARY TABLE', 'other_schema'),
    ];

    const result = sortDatabaseObjects(input, enums);

    expect(result.map((o) => `${o.schema}.${o.name}`)).toEqual([
      'public.my_table',
      'other_schema.my_table',
    ]);
  });

  test('should not mutate the original array', () => {
    const input = [obj('b_view', 'VIEW'), obj('a_table', 'ORDINARY TABLE')];
    const original = [...input];

    sortDatabaseObjects(input);

    expect(input).toEqual(original);
  });
});
