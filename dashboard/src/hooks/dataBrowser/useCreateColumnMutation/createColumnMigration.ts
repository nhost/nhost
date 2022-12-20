import type {
  AffectedRowsResult,
  DatabaseColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/utils/dataBrowser/hasuraQueryHelpers';
import normalizeQueryError from '@/utils/dataBrowser/normalizeQueryError';
import { LOCAL_MIGRATIONS_URL } from '@/utils/env';
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

  const response = await fetch(`${LOCAL_MIGRATIONS_URL}/apis/migrate`, {
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
