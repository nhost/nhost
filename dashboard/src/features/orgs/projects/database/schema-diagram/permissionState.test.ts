import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  ADMIN_ROLE,
  getColumnPermissionState,
  getComputedFieldPermissionState,
  getRelevantRules,
  getTablePermissionState,
  isOperationAllowed,
  tableHasAnyPermission,
} from './permissionState';

function buildTable(
  overrides: Partial<HasuraMetadataTable> = {},
): HasuraMetadataTable {
  return {
    table: { name: 'users', schema: 'public' },
    configuration: {},
    ...overrides,
  };
}

describe('getTablePermissionState', () => {
  it('returns "filled" for admin regardless of metadata', () => {
    const table = buildTable();
    expect(getTablePermissionState(table, ADMIN_ROLE, 'select')).toBe('filled');
    expect(getTablePermissionState(table, ADMIN_ROLE, 'insert')).toBe('filled');
    expect(getTablePermissionState(table, ADMIN_ROLE, 'update')).toBe('filled');
    expect(getTablePermissionState(table, ADMIN_ROLE, 'delete')).toBe('filled');
  });

  it('returns "none" when no permission exists for the role', () => {
    const table = buildTable({
      select_permissions: [
        { role: 'manager', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'select')).toBe('none');
  });

  it('returns "filled" when select has an empty filter', () => {
    const table = buildTable({
      select_permissions: [
        { role: 'user', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'select')).toBe('filled');
  });

  it('returns "hollow" when select has a non-empty filter', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: { id: { _eq: 'X-Hasura-User-Id' } },
          },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'select')).toBe('hollow');
  });

  it('returns "hollow" when insert has a non-empty check', () => {
    const table = buildTable({
      insert_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            check: { id: { _eq: 'X-Hasura-User-Id' } },
          },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'insert')).toBe('hollow');
  });

  it('returns "filled" when update has empty filter and empty check', () => {
    const table = buildTable({
      update_permissions: [
        {
          role: 'user',
          permission: { columns: ['name'], filter: {}, check: {} },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'update')).toBe('filled');
  });

  it('returns "hollow" when update has a non-empty filter and empty check', () => {
    const table = buildTable({
      update_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['name'],
            filter: { id: { _eq: 'X-Hasura-User-Id' } },
            check: {},
          },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'update')).toBe('hollow');
  });

  it('returns "hollow" when update has a non-empty check and empty filter', () => {
    const table = buildTable({
      update_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['name'],
            filter: {},
            check: { name: { _is_null: false } },
          },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'update')).toBe('hollow');
  });

  it('returns "hollow" when update has both filter and check set', () => {
    const table = buildTable({
      update_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['name'],
            filter: { id: { _eq: 'X-Hasura-User-Id' } },
            check: { name: { _is_null: false } },
          },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'update')).toBe('hollow');
  });

  it('returns "hollow" when delete has a non-empty filter', () => {
    const table = buildTable({
      delete_permissions: [
        {
          role: 'user',
          permission: { filter: { id: { _eq: 'X-Hasura-User-Id' } } },
        },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'delete')).toBe('hollow');
  });

  it('returns "filled" when delete has no filter', () => {
    const table = buildTable({
      delete_permissions: [{ role: 'user', permission: {} }],
    });
    expect(getTablePermissionState(table, 'user', 'delete')).toBe('filled');
  });
});

describe('getColumnPermissionState', () => {
  it('returns "filled" for admin on any column', () => {
    expect(
      getColumnPermissionState(buildTable(), ADMIN_ROLE, 'select', 'id'),
    ).toBe('filled');
  });

  it('returns "none" when the table-level permission is "none"', () => {
    const table = buildTable();
    expect(getColumnPermissionState(table, 'user', 'select', 'id')).toBe(
      'none',
    );
  });

  it('returns "none" when the column is not in the allowed columns list', () => {
    const table = buildTable({
      select_permissions: [
        { role: 'user', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(getColumnPermissionState(table, 'user', 'select', 'email')).toBe(
      'none',
    );
  });

  it('mirrors the table state when the column is in the allowed list', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: { columns: ['id', 'email'], filter: { id: { _eq: 1 } } },
        },
      ],
    });
    expect(getColumnPermissionState(table, 'user', 'select', 'email')).toBe(
      'hollow',
    );
  });

  it('ignores the column list for delete operations', () => {
    const table = buildTable({
      delete_permissions: [
        { role: 'user', permission: { filter: { id: { _eq: 1 } } } },
      ],
    });
    expect(getColumnPermissionState(table, 'user', 'delete', 'email')).toBe(
      'hollow',
    );
  });

  it('reflects update row filter at the column level', () => {
    const table = buildTable({
      update_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['name'],
            filter: { id: { _eq: 'X-Hasura-User-Id' } },
            check: {},
          },
        },
      ],
    });
    expect(getColumnPermissionState(table, 'user', 'update', 'name')).toBe(
      'hollow',
    );
  });
});

describe('getComputedFieldPermissionState', () => {
  it('returns "filled" for admin regardless of computed_fields metadata', () => {
    expect(
      getComputedFieldPermissionState(buildTable(), ADMIN_ROLE, 'full_name'),
    ).toBe('filled');
  });

  it('returns "none" when no select permission exists for the role', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'manager',
          permission: {
            columns: ['id'],
            filter: {},
            computed_fields: ['full_name'],
          },
        },
      ],
    });
    expect(getComputedFieldPermissionState(table, 'user', 'full_name')).toBe(
      'none',
    );
  });

  it('returns "none" when the field is not in the allowed computed_fields list', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            computed_fields: ['other_field'],
          },
        },
      ],
    });
    expect(getComputedFieldPermissionState(table, 'user', 'full_name')).toBe(
      'none',
    );
  });

  it('returns "none" when computed_fields is omitted or null', () => {
    const tableWithUnset = buildTable({
      select_permissions: [
        { role: 'user', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(
      getComputedFieldPermissionState(tableWithUnset, 'user', 'full_name'),
    ).toBe('none');

    const tableWithNull = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            computed_fields: null,
          },
        },
      ],
    });
    expect(
      getComputedFieldPermissionState(tableWithNull, 'user', 'full_name'),
    ).toBe('none');
  });

  it('mirrors the table state when the field is in the allowed list', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: { id: { _eq: 'X-Hasura-User-Id' } },
            computed_fields: ['full_name'],
          },
        },
      ],
    });
    expect(getComputedFieldPermissionState(table, 'user', 'full_name')).toBe(
      'hollow',
    );
  });

  it('returns "filled" when the field is allowed and the filter is empty', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            computed_fields: ['full_name'],
          },
        },
      ],
    });
    expect(getComputedFieldPermissionState(table, 'user', 'full_name')).toBe(
      'filled',
    );
  });
});

describe('getRelevantRules', () => {
  it('returns only the filter for select', () => {
    expect(
      getRelevantRules({ filter: { id: { _eq: 1 } }, check: {} }, 'select'),
    ).toEqual([{ key: 'filter', value: { id: { _eq: 1 } } }]);
  });

  it('returns only the check for insert', () => {
    expect(
      getRelevantRules({ filter: {}, check: { id: { _eq: 1 } } }, 'insert'),
    ).toEqual([{ key: 'check', value: { id: { _eq: 1 } } }]);
  });

  it('returns both filter and check for update when both are set', () => {
    expect(
      getRelevantRules(
        {
          filter: { id: { _eq: 'X-Hasura-User-Id' } },
          check: { name: { _is_null: false } },
        },
        'update',
      ),
    ).toEqual([
      { key: 'filter', value: { id: { _eq: 'X-Hasura-User-Id' } } },
      { key: 'check', value: { name: { _is_null: false } } },
    ]);
  });

  it('returns only the filter for update when check is empty', () => {
    expect(
      getRelevantRules(
        { filter: { id: { _eq: 'X-Hasura-User-Id' } }, check: {} },
        'update',
      ),
    ).toEqual([{ key: 'filter', value: { id: { _eq: 'X-Hasura-User-Id' } } }]);
  });

  it('returns an empty list when no permission is provided', () => {
    expect(getRelevantRules(undefined, 'update')).toEqual([]);
  });

  it('returns an empty list when every relevant rule is empty', () => {
    expect(getRelevantRules({ filter: {}, check: {} }, 'update')).toEqual([]);
  });
});

describe('isOperationAllowed', () => {
  it('returns true for admin regardless of metadata', () => {
    expect(isOperationAllowed(undefined, ADMIN_ROLE, 'select', 'select')).toBe(
      true,
    );
    expect(
      isOperationAllowed(buildTable(), ADMIN_ROLE, 'insert', 'insert_one'),
    ).toBe(true);
  });

  it('returns false when the role has no permission for the action', () => {
    const table = buildTable();
    expect(isOperationAllowed(table, 'user', 'select', 'select')).toBe(false);
    expect(isOperationAllowed(table, 'user', 'insert', 'insert')).toBe(false);
  });

  it('returns true for insert/update/delete root fields whenever the action permission exists', () => {
    const table = buildTable({
      insert_permissions: [
        { role: 'user', permission: { columns: ['id'], check: {} } },
      ],
      update_permissions: [
        {
          role: 'user',
          permission: { columns: ['id'], filter: {}, check: {} },
        },
      ],
      delete_permissions: [
        { role: 'user', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(isOperationAllowed(table, 'user', 'insert', 'insert')).toBe(true);
    expect(isOperationAllowed(table, 'user', 'insert', 'insert_one')).toBe(
      true,
    );
    expect(isOperationAllowed(table, 'user', 'update', 'update_many')).toBe(
      true,
    );
    expect(isOperationAllowed(table, 'user', 'delete', 'delete_by_pk')).toBe(
      true,
    );
  });

  it('allows every select root field by default when no root_fields are configured', () => {
    const table = buildTable({
      select_permissions: [
        { role: 'user', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(isOperationAllowed(table, 'user', 'select', 'select')).toBe(true);
    expect(isOperationAllowed(table, 'user', 'select', 'select_by_pk')).toBe(
      true,
    );
    // select_aggregate also needs allow_aggregations.
    expect(
      isOperationAllowed(table, 'user', 'select', 'select_aggregate'),
    ).toBe(false);
    expect(isOperationAllowed(table, 'user', 'select', 'select_stream')).toBe(
      true,
    );
  });

  it('restricts query root fields when query_root_fields is set', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: ['select_by_pk'],
            subscription_root_fields: [],
          },
        },
      ],
    });
    expect(isOperationAllowed(table, 'user', 'select', 'select')).toBe(false);
    expect(isOperationAllowed(table, 'user', 'select', 'select_by_pk')).toBe(
      true,
    );
  });

  it('keeps a root field reachable when it is allowed via either query or subscription', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: ['select'],
            subscription_root_fields: ['select_by_pk'],
          },
        },
      ],
    });
    expect(isOperationAllowed(table, 'user', 'select', 'select')).toBe(true);
    expect(isOperationAllowed(table, 'user', 'select', 'select_by_pk')).toBe(
      true,
    );
  });

  it('treats select_stream as subscription-only (query_root_fields never grants it)', () => {
    const queryOnly = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: ['select_stream'],
            subscription_root_fields: [],
          },
        },
      ],
    });
    expect(
      isOperationAllowed(queryOnly, 'user', 'select', 'select_stream'),
    ).toBe(false);

    const subAllowed = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: [],
            subscription_root_fields: ['select_stream'],
          },
        },
      ],
    });
    expect(
      isOperationAllowed(subAllowed, 'user', 'select', 'select_stream'),
    ).toBe(true);
  });

  it('requires allow_aggregations to be true for select_aggregate, even if listed in root_fields', () => {
    const withoutAggregations = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: ['select_aggregate'],
            allow_aggregations: false,
          },
        },
      ],
    });
    expect(
      isOperationAllowed(
        withoutAggregations,
        'user',
        'select',
        'select_aggregate',
      ),
    ).toBe(false);

    const withAggregations = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: ['select_aggregate'],
            allow_aggregations: true,
          },
        },
      ],
    });
    expect(
      isOperationAllowed(
        withAggregations,
        'user',
        'select',
        'select_aggregate',
      ),
    ).toBe(true);
  });

  it('denies everything when both root_fields are empty arrays', () => {
    const table = buildTable({
      select_permissions: [
        {
          role: 'user',
          permission: {
            columns: ['id'],
            filter: {},
            query_root_fields: [],
            subscription_root_fields: [],
          },
        },
      ],
    });
    expect(isOperationAllowed(table, 'user', 'select', 'select')).toBe(false);
    expect(isOperationAllowed(table, 'user', 'select', 'select_by_pk')).toBe(
      false,
    );
    expect(isOperationAllowed(table, 'user', 'select', 'select_stream')).toBe(
      false,
    );
  });
});

describe('tableHasAnyPermission', () => {
  it('returns true for admin', () => {
    expect(tableHasAnyPermission(buildTable(), ADMIN_ROLE)).toBe(true);
  });

  it('returns false when no permissions are configured', () => {
    expect(tableHasAnyPermission(buildTable(), 'user')).toBe(false);
  });

  it('returns true when at least one operation is permitted', () => {
    const table = buildTable({
      select_permissions: [
        { role: 'user', permission: { columns: ['id'], filter: {} } },
      ],
    });
    expect(tableHasAnyPermission(table, 'user')).toBe(true);
  });
});
