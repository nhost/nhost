import type { NativeQueryMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import buildTrackNativeQueryStep from './buildTrackNativeQueryStep';

export interface CreateNativeQueryMigrationVariables {
  source: string;
  args: NativeQueryMutationArgs;
}

export default async function createNativeQueryMigration({
  adminSecret,
  source,
  args,
}: MigrationOperationOptions & CreateNativeQueryMigrationVariables) {
  const datasource = source;
  try {
    const response = await executeMigration(
      {
        name: `track_native_query_${args.root_field_name}`,
        up: [
          {
            type: 'bulk_atomic',
            args: [buildTrackNativeQueryStep(source, args)],
          },
        ],
        down: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_native_query',
                args: {
                  source: datasource,
                  root_field_name: args.root_field_name,
                },
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
