import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { CreateRelationshipVariables } from './createRelationship';

export default async function createRelationshipMigration({
  appUrl,
  adminSecret,
  args,
  type,
}: MigrationOperationOptions & CreateRelationshipVariables) {
  const response = await executeMigration(
    {
      name: `create_relationship_${args.table.schema}_${args.table.name}_${args.name}`,
      up: [{ type, args }],
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
