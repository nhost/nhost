import type {
  AffectedRowsResult,
  DatabaseColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import prepareCreateColumnQuery from './prepareCreateColumnQuery';

export interface CreateColumnMigrationVariables {
  /**
   * The column to create.
   */
  column: DatabaseColumn;
}

export interface CreateColumnMigrationOptions
  extends MutationOrQueryBaseOptions {}

export default async function createColumnMigration({
  dataSource,
  schema,
  table,
  adminSecret,
  column,
}: CreateColumnMigrationOptions & CreateColumnMigrationVariables) {
  const args = prepareCreateColumnQuery({
    dataSource,
    schema,
    table,
    column,
  });

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `alter_table_${schema}_${table}_add_column_${column.name}`,
      down: [
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I',
          schema,
          table,
          column.name,
        ),
      ],
      up: args,
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
