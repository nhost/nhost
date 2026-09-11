import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import buildTrackNativeQueryStep from './buildTrackNativeQueryStep';

export interface DeleteNativeQueryMigrationVariables {
  source: string;
  original: NativeQueryItem;
}

export default async function deleteNativeQueryMigration({
  adminSecret,
  source,
  original,
}: MigrationOperationOptions & DeleteNativeQueryMigrationVariables) {
  const datasource = source;
  try {
    const response = await executeMigration(
      {
        name: `untrack_native_query_${original.root_field_name}`,
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
            ],
          },
        ],
        down: [
          {
            type: 'bulk_atomic',
            args: [buildTrackNativeQueryStep(source, original)],
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
