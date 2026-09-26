import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { DeleteRelationshipVariables } from './deleteRelationship';

export default async function deleteRelationshipMigration({
  appUrl,
  adminSecret,
  args,
  type,
}: MigrationOperationOptions & DeleteRelationshipVariables) {
  const response = await executeMigration(
    {
      name: `delete_relationship_${args.table.schema}_${args.table.name}_${args.relationshipName}`,
      up: [
        type === 'local'
          ? {
              type: 'pg_drop_relationship',
              args: {
                table: args.table,
                source: args.source,
                relationship: args.relationshipName,
              },
            }
          : {
              type: 'pg_delete_remote_relationship',
              args: {
                table: args.table,
                source: args.source,
                name: args.relationshipName,
              },
            },
      ],
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
