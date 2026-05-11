import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  ADMIN_ROLE,
  getColumnPermissionState,
  getTablePermissionState,
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

  it('returns "filled" when update has an empty check', () => {
    const table = buildTable({
      update_permissions: [
        { role: 'user', permission: { columns: ['name'], check: {} } },
      ],
    });
    expect(getTablePermissionState(table, 'user', 'update')).toBe('filled');
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
