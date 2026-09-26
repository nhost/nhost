import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export default async function dropInconsistentMetadataMigration({
  appUrl,
  adminSecret,
}: MigrationOperationOptions) {
  const response = await executeMigration(
    {
      name: 'drop_inconsistent_metadata',
      up: [{ type: 'drop_inconsistent_metadata', args: {} }],
      down: [],
      datasource: 'default',
      skip_execution: false,
    },
    { appUrl, adminSecret },
  );

  if (response.status === 200) {
    return response.data;
  }

  throw new Error(
    response.data.message ?? response.data.error ?? 'Unknown error',
  );
}
