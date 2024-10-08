import type {
  AffectedRowsResult,
  DatabaseTable,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
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

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
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
