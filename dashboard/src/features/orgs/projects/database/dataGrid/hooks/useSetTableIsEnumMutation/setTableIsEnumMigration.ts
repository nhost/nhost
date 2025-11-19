import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import type { SetTableIsEnumArgs } from '@/utils/hasura-api/generated/schemas';

export interface SetTableIsEnumMigrationVariables {
  resourceVersion: number;
  args: SetTableIsEnumArgs;
}

export default async function setTableIsEnumMigration({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & SetTableIsEnumMigrationVariables) {
  // TODO: Implement set table is enum migration
}
