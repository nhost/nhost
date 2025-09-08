import type { RemoteSchemaInfoPermissionsItem } from '@/utils/hasura-api/generated/schemas';

export const findRemoteSchemaPermission = (
  perms: RemoteSchemaInfoPermissionsItem[],
  role: string,
): RemoteSchemaInfoPermissionsItem | undefined =>
  perms.find((p) => p.role === role);
