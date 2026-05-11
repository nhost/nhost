import { findPermission } from '@/components/common/PermissionsGrid';
import type {
  DatabaseAction,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export const ADMIN_ROLE = 'admin';

export const DATABASE_ACTIONS: readonly DatabaseAction[] = [
  'select',
  'insert',
  'update',
  'delete',
] as const;

export type PermissionDotState = 'none' | 'filled' | 'hollow';

function isEmptyConstraint(
  value: Record<string, unknown> | undefined,
): boolean {
  return !value || Object.keys(value).length === 0;
}

export function getTablePermissionState(
  table: HasuraMetadataTable | undefined,
  role: string,
  action: DatabaseAction,
): PermissionDotState {
  if (role === ADMIN_ROLE) {
    return 'filled';
  }

  const permission = findPermission(table, role, action);

  if (!permission) {
    return 'none';
  }

  const constraint =
    action === 'insert' || action === 'update'
      ? permission.check
      : permission.filter;

  return isEmptyConstraint(constraint) ? 'filled' : 'hollow';
}

export function getColumnPermissionState(
  table: HasuraMetadataTable | undefined,
  role: string,
  action: DatabaseAction,
  columnName: string,
): PermissionDotState {
  const tableState = getTablePermissionState(table, role, action);

  if (tableState === 'none') {
    return 'none';
  }

  if (role === ADMIN_ROLE || action === 'delete') {
    return tableState;
  }

  const permission = findPermission(table, role, action);
  const allowedColumns = permission?.columns ?? [];

  if (!allowedColumns.includes(columnName)) {
    return 'none';
  }

  return tableState;
}

export function tableHasAnyPermission(
  table: HasuraMetadataTable | undefined,
  role: string,
): boolean {
  if (role === ADMIN_ROLE) {
    return true;
  }

  return DATABASE_ACTIONS.some(
    (action) => getTablePermissionState(table, role, action) !== 'none',
  );
}
