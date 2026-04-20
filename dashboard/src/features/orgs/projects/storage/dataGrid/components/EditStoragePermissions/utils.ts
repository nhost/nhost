import type { HasuraMetadataPermission } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { STORAGE_COLUMNS_BY_ACTION, type StorageAction } from './types';

export function hasRequiredColumns(
  storageAction: StorageAction,
  permission: HasuraMetadataPermission['permission'] | undefined,
): boolean {
  if (!permission) {
    return false;
  }
  const expectedColumns = STORAGE_COLUMNS_BY_ACTION[storageAction];
  const permissionColumns = permission.columns ?? [];
  return (
    expectedColumns.length === 0 ||
    expectedColumns.every((col) => permissionColumns.includes(col))
  );
}
