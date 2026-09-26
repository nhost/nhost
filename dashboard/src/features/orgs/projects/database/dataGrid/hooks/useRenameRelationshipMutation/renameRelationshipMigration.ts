import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { RenameRelationshipVariables } from './renameRelationship';

export default async function renameRelationshipMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & RenameRelationshipVariables) {
  const response = await executeMigration(
    {
      name: `rename_relationship_${args.table.schema}_${args.table.name}_${args.name}`,
      up: [{ type: 'pg_rename_relationship', args }],
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
