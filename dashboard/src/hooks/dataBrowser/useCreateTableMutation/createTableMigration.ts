import type {
  AffectedRowsResult,
  DatabaseTable,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/utils/dataBrowser/hasuraQueryHelpers';
import normalizeQueryError from '@/utils/dataBrowser/normalizeQueryError';
import { LOCAL_MIGRATIONS_URL } from '@/utils/env';
import prepareCreateTableQuery from './prepareCreateTableQuery';

export interface CreateTableMigrationVariables {
  /**
   * Table to create.
   */
  table: DatabaseTable;
}

export interface CreateTableMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function createTableMigration({
  dataSource,
  schema,
  adminSecret,
  table,
}: CreateTableMigrationOptions & CreateTableMigrationVariables) {
  const args = prepareCreateTableQuery({ dataSource, schema, table });

  const response = await fetch(`${LOCAL_MIGRATIONS_URL}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `create_table_${schema}_${table.name}`,
      down: [
        getPreparedHasuraQuery(
          dataSource,
          'DROP TABLE IF EXISTS %I.%I',
          schema,
          table.name,
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
