import type { SetTableIsEnumArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import setTableIsEnum from './setTableIsEnum';

export interface SetTableIsEnumMigrationVariables {
  resourceVersion?: number;
  args: SetTableIsEnumArgs;
}

export default async function setTableIsEnumMigration({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MigrationOperationOptions & SetTableIsEnumMigrationVariables) {
  /**
   * TODO: Build the executeMigration flow once the up/down steps are known.
   */
  if (resourceVersion == null) {
    throw new Error(
      'resourceVersion is required while the metadata fallback is in place.',
    );
  }

  return setTableIsEnum({
    appUrl,
    adminSecret,
    resourceVersion,
    args,
  });
}
