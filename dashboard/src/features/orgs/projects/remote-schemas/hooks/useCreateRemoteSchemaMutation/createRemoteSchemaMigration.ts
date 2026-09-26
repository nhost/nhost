import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { CreateRemoteSchemaVariables } from './createRemoteSchema';

export default async function createRemoteSchemaMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & CreateRemoteSchemaVariables) {
  const response = await executeMigration(
    {
      name: `create_remote_schema_${args.name}`,
      up: [{ type: 'add_remote_schema', args }],
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
