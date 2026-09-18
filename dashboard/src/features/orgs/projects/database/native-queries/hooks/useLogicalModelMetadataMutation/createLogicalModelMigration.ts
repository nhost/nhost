import type { LogicalModelMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/types';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface CreateLogicalModelMigrationVariables {
  source: string;
  args: LogicalModelMutationArgs;
}

export default async function createLogicalModelMigration({
  adminSecret,
  source,
  args,
}: MigrationOperationOptions & CreateLogicalModelMigrationVariables) {
  const datasource = source;
  try {
    const response = await executeMigration(
      {
        name: `track_logical_model_${args.name}`,
        up: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_track_logical_model',
                args: { ...args, source: datasource },
              },
            ],
          },
        ],
        down: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_logical_model',
                args: { source: datasource, name: args.name },
              },
            ],
          },
        ],
        datasource,
      },
      {
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
