import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { TrackTableArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface TrackTableMigrationVariables {
  args: TrackTableArgs;
}

export default async function trackTableMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & TrackTableMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `add_existing_table_or_view_${args.table.schema}_${args.table.name}`,
        down: [
          {
            type: 'pg_untrack_table',
            args,
          },
        ],
        up: [
          {
            type: 'pg_track_table',
            args,
          },
        ],
        datasource: args.source ?? 'default',
        skip_execution: false,
      },
      {
        baseUrl: appUrl,
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
