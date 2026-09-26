import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { UpdateRemoteSchemaRelationshipVariables } from './updateRemoteSchemaRelationship';

export default async function updateRemoteSchemaRelationshipMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & UpdateRemoteSchemaRelationshipVariables) {
  const response = await executeMigration(
    {
      name: `update_remote_schema_relationship_${args.remote_schema}_${args.type_name}_${args.name}`,
      up: [{ type: 'update_remote_schema_remote_relationship', args }],
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
