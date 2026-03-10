import { describe, expect, test } from 'vitest';
import buildTrackingOperation from './buildTrackingOperation';

const baseParams = {
  resourceVersion: 42,
  source: 'default',
  schema: 'public',
  name: 'users',
};

describe('buildTrackingOperation', () => {
  test('should build a pg_track_table operation for tables', () => {
    const result = buildTrackingOperation({
      ...baseParams,
      isFunction: false,
      tracked: true,
    });

    expect(result).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 42,
      args: [
        {
          type: 'pg_track_table',
          args: { source: 'default', table: { name: 'users', schema: 'public' } },
        },
      ],
    });
  });

  test('should build a pg_untrack_table operation for tables', () => {
    const result = buildTrackingOperation({
      ...baseParams,
      isFunction: false,
      tracked: false,
    });

    expect(result).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 42,
      args: [
        {
          type: 'pg_untrack_table',
          args: { source: 'default', table: { name: 'users', schema: 'public' } },
        },
      ],
    });
  });

  test('should build a pg_track_function operation for functions', () => {
    const result = buildTrackingOperation({
      ...baseParams,
      isFunction: true,
      tracked: true,
      name: 'search_users',
    });

    expect(result).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 42,
      args: [
        {
          type: 'pg_track_function',
          args: {
            source: 'default',
            function: { name: 'search_users', schema: 'public' },
          },
        },
      ],
    });
  });

  test('should build a pg_untrack_function operation for functions', () => {
    const result = buildTrackingOperation({
      ...baseParams,
      isFunction: true,
      tracked: false,
      name: 'search_users',
    });

    expect(result).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 42,
      args: [
        {
          type: 'pg_untrack_function',
          args: {
            source: 'default',
            function: { name: 'search_users', schema: 'public' },
          },
        },
      ],
    });
  });

  test('should use the provided source and schema', () => {
    const result = buildTrackingOperation({
      isFunction: false,
      tracked: true,
      resourceVersion: 7,
      source: 'my_db',
      schema: 'private',
      name: 'orders',
    });

    expect(result).toEqual({
      type: 'bulk',
      source: 'my_db',
      resource_version: 7,
      args: [
        {
          type: 'pg_track_table',
          args: { source: 'my_db', table: { name: 'orders', schema: 'private' } },
        },
      ],
    });
  });
});
