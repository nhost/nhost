import { describe, expect, it } from 'vitest';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getOperationNamesForAction } from './operationNames';

function makeMetadataTable(
  schema: string,
  table: string,
  // biome-ignore lint/suspicious/noExplicitAny: looser type for test fixtures matches the actual generated shape.
  configuration: Record<string, any> = {},
): HasuraMetadataTable {
  return {
    table: { schema, name: table },
    configuration,
  } as HasuraMetadataTable;
}

describe('getOperationNamesForAction', () => {
  it('returns nothing for untracked tables', () => {
    expect(
      getOperationNamesForAction(undefined, 'public', 'users', 'select'),
    ).toEqual([]);
  });

  it('uses the bare table name in the public schema', () => {
    const meta = makeMetadataTable('public', 'users');

    expect(
      getOperationNamesForAction(meta, 'public', 'users', 'select').map(
        (o) => o.name,
      ),
    ).toEqual(['users', 'users_by_pk', 'users_aggregate', 'users_stream']);

    expect(
      getOperationNamesForAction(meta, 'public', 'users', 'insert').map(
        (o) => o.name,
      ),
    ).toEqual(['insert_users', 'insert_users_one']);

    expect(
      getOperationNamesForAction(meta, 'public', 'users', 'update').map(
        (o) => o.name,
      ),
    ).toEqual(['update_users', 'update_users_by_pk', 'update_many_users']);

    expect(
      getOperationNamesForAction(meta, 'public', 'users', 'delete').map(
        (o) => o.name,
      ),
    ).toEqual(['delete_users', 'delete_users_by_pk']);
  });

  it('prefixes the schema for non-public schemas', () => {
    const meta = makeMetadataTable('auth', 'users');

    expect(
      getOperationNamesForAction(meta, 'auth', 'users', 'select').map(
        (o) => o.name,
      ),
    ).toEqual([
      'auth_users',
      'auth_users_by_pk',
      'auth_users_aggregate',
      'auth_users_stream',
    ]);

    expect(
      getOperationNamesForAction(meta, 'auth', 'users', 'insert').map(
        (o) => o.name,
      ),
    ).toEqual(['insert_auth_users', 'insert_auth_users_one']);
  });

  it('uses configuration.custom_name as the base for derived ops', () => {
    const meta = makeMetadataTable('auth', 'users', { custom_name: 'User' });

    expect(
      getOperationNamesForAction(meta, 'auth', 'users', 'select').map(
        (o) => o.name,
      ),
    ).toEqual(['User', 'User_by_pk', 'User_aggregate', 'User_stream']);

    expect(
      getOperationNamesForAction(meta, 'auth', 'users', 'update').map(
        (o) => o.name,
      ),
    ).toEqual(['update_User', 'update_User_by_pk', 'update_many_User']);
  });

  it('honors per-operation custom_root_fields as string', () => {
    const meta = makeMetadataTable('public', 'users', {
      custom_root_fields: {
        select_by_pk: 'userById',
        insert: 'createUsers',
      },
    });

    const select = getOperationNamesForAction(
      meta,
      'public',
      'users',
      'select',
    );
    expect(select).toEqual([
      { name: 'users', label: 'Select', isCustom: false },
      { name: 'userById', label: 'Select by PK', isCustom: true },
      { name: 'users_aggregate', label: 'Select aggregate', isCustom: false },
      { name: 'users_stream', label: 'Select stream', isCustom: false },
    ]);

    const insert = getOperationNamesForAction(
      meta,
      'public',
      'users',
      'insert',
    );
    expect(insert).toEqual([
      { name: 'createUsers', label: 'Insert', isCustom: true },
      { name: 'insert_users_one', label: 'Insert one', isCustom: false },
    ]);
  });

  it('honors per-operation custom_root_fields as CustomRootField object', () => {
    const meta = makeMetadataTable('public', 'users', {
      custom_root_fields: {
        delete: { name: 'wipeUsers', comment: '' },
        delete_by_pk: { name: 'wipeUserById' },
      },
    });

    expect(
      getOperationNamesForAction(meta, 'public', 'users', 'delete'),
    ).toEqual([
      { name: 'wipeUsers', label: 'Delete', isCustom: true },
      { name: 'wipeUserById', label: 'Delete by PK', isCustom: true },
    ]);
  });

  it('falls back to defaults when a custom name is empty or whitespace', () => {
    const meta = makeMetadataTable('public', 'users', {
      custom_name: '',
      custom_root_fields: {
        select: '',
        select_by_pk: { name: '' },
        insert: { name: null },
        update: null,
      },
    });

    const select = getOperationNamesForAction(
      meta,
      'public',
      'users',
      'select',
    );
    expect(select.slice(0, 2)).toEqual([
      { name: 'users', label: 'Select', isCustom: false },
      { name: 'users_by_pk', label: 'Select by PK', isCustom: false },
    ]);

    const insert = getOperationNamesForAction(
      meta,
      'public',
      'users',
      'insert',
    );
    expect(insert[0]).toEqual({
      name: 'insert_users',
      label: 'Insert',
      isCustom: false,
    });

    const update = getOperationNamesForAction(
      meta,
      'public',
      'users',
      'update',
    );
    expect(update[0]).toEqual({
      name: 'update_users',
      label: 'Update',
      isCustom: false,
    });
  });

  it('combines custom_name with per-op overrides correctly', () => {
    const meta = makeMetadataTable('auth', 'users', {
      custom_name: 'User',
      custom_root_fields: {
        insert_one: 'createOneUser',
      },
    });

    const insert = getOperationNamesForAction(meta, 'auth', 'users', 'insert');
    expect(insert).toEqual([
      { name: 'insert_User', label: 'Insert', isCustom: false },
      { name: 'createOneUser', label: 'Insert one', isCustom: true },
    ]);
  });
});
