import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export default async function clearMetadataMigration({
  appUrl,
  adminSecret,
}: MigrationOperationOptions) {
  const response = await executeMigration(
    {
      name: 'clear_metadata',
      up: [{ type: 'clear_metadata', args: {} }],
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
