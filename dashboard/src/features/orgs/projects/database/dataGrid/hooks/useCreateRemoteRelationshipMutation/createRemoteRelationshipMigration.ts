import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { CreateRemoteRelationshipVariables } from './createRemoteRelationship';

export default async function createRemoteRelationshipMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & CreateRemoteRelationshipVariables) {
  const response = await executeMigration(
    {
      name: `set_remote_relationship_${args.table.schema}_${args.table.name}_${args.name}`,
      up: [{ type: 'pg_create_remote_relationship', args }],
      down: [],
      datasource: args.source ?? 'default',
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
