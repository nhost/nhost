import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import type { SetTableCustomizationArgs } from '@/utils/hasura-api/generated/schemas';

export interface SetTableCustomizationMigrationVariables {
  resourceVersion?: number;
  args: SetTableCustomizationArgs;
}

export default async function setTableCustomizationMigration({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & SetTableCustomizationMigrationVariables) {
  // TODO: Implement set table customization migration
}
