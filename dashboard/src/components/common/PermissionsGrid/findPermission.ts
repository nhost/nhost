import type {
  DatabaseAction,
  HasuraMetadataPermission,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function findPermission(
  metadataForTable: HasuraMetadataTable | undefined,
  role: string,
  action: DatabaseAction,
): HasuraMetadataPermission['permission'] | undefined {
  const permMap = {
    insert: metadataForTable?.insert_permissions,
    select: metadataForTable?.select_permissions,
    update: metadataForTable?.update_permissions,
    delete: metadataForTable?.delete_permissions,
  };
  return permMap[action]?.find(
    ({ role: permissionRole }) => permissionRole === role,
  )?.permission;
}
