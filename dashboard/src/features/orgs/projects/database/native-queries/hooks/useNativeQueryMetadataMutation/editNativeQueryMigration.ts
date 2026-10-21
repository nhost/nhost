import type { NativeQueryMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import buildTrackNativeQueryStep from './buildTrackNativeQueryStep';

export interface EditNativeQueryMigrationVariables {
  source: string;
  args: NativeQueryMutationArgs;
  original: NativeQueryItem;
}

export default async function editNativeQueryMigration({
  adminSecret,
  source,
  args,
  original,
}: MigrationOperationOptions & EditNativeQueryMigrationVariables) {
  const datasource = source;
  try {
    const response = await executeMigration(
      {
        name: `update_native_query_${original.root_field_name}`,
        up: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_native_query',
                args: {
                  source: datasource,
                  root_field_name: original.root_field_name,
                },
              },
              buildTrackNativeQueryStep(source, args),
            ],
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
              buildTrackNativeQueryStep(source, original),
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
