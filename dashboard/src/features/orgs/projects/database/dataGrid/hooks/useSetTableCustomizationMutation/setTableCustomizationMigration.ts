import type { SetTableCustomizationArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import setTableCustomization from './setTableCustomization';

export interface SetTableCustomizationMigrationVariables {
  resourceVersion?: number;
  args: SetTableCustomizationArgs;
}

export default async function setTableCustomizationMigration({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MigrationOperationOptions & SetTableCustomizationMigrationVariables) {
  /**
   * TODO: Build a proper executeMigration flow once the expected up/down steps are defined.
   */
  if (resourceVersion == null) {
    throw new Error(
      'resourceVersion is required while the metadata fallback is in place.',
    );
  }

  return setTableCustomization({
    appUrl,
    adminSecret,
    resourceVersion,
    args,
  });
}
