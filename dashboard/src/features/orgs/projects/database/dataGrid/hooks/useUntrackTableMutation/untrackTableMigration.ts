import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export interface UntrackTableMigrationVariables {
  /**
   * Table to untrack.
   */
  table: { name: string };
}

export interface UntrackTableMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function untrackTableMigration({
  dataSource,
  schema,
  adminSecret,
  table,
}: UntrackTableMigrationOptions & UntrackTableMigrationVariables) {
  const response = await fetch(`${getHasuraMigrationsApiUrl()}`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `remove_existing_table_or_view_${schema}_${table.name}`,
      down: [
        {
          type: 'pg_track_table',
          args: { source: dataSource, table: { schema, name: table.name } },
        },
      ],
      up: [
        {
          args: {
            source: dataSource,
            table: { schema, name: table.name },
            cascade: true,
          },
          type: 'pg_untrack_table',
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
