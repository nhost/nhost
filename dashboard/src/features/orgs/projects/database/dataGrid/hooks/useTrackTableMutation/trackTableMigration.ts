import type {
  AffectedRowsResult,
  DatabaseTable,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export interface TrackTableMigrationVariables {
  /**
   * Table to track.
   */
  table: DatabaseTable;
}

export interface TrackTableMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function trackTableMigration({
  dataSource,
  schema,
  adminSecret,
  table,
}: TrackTableMigrationOptions & TrackTableMigrationVariables) {
  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `add_existing_table_or_view_${schema}_${table.name}`,
      down: [
        {
          type: 'pg_untrack_table',
          args: { source: dataSource, table: { schema, name: table.name } },
        },
      ],
      up: [
        {
          args: { source: dataSource, table: { schema, name: table.name } },
          type: 'pg_track_table',
        },
      ],
    }),
  });

  const responseData: [AffectedRowsResult, QueryResult<string[]>] | QueryError =
    await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
