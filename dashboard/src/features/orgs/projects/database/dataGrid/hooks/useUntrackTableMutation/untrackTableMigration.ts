import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { UntrackTableArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface UntrackTableMigrationVariables {
  args: UntrackTableArgs;
}

export default async function untrackTableMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & UntrackTableMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `remove_existing_table_or_view_${args.table.schema}_${args.table.name}`,
        down: [
          {
            type: 'pg_track_table',
            args: { source: args.source, table: args.table },
          },
        ],
        up: [
          {
            type: 'pg_untrack_table',
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
