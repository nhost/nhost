import type {
  AffectedRowsResult,
  DatabaseColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getEmptyDownMigrationMessage } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import prepareUpdateColumnQuery from './prepareUpdateColumnQuery';

export interface UpdateColumnMigrationVariables {
  /**
   * Original column.
   */
  originalColumn: DatabaseColumn;
  /**
   * Updated column data.
   */
  column: DatabaseColumn;
}

export interface UpdateColumnMigrationOptions
  extends MutationOrQueryBaseOptions {}

export default async function updateColumnMigration({
  dataSource,
  schema,
  table,
  adminSecret,
  originalColumn,
  column,
}: UpdateColumnMigrationOptions & UpdateColumnMigrationVariables) {
  const columnUpdateUpMigration = prepareUpdateColumnQuery({
    dataSource,
    schema,
    table,
    originalColumn,
    column,
  });

  if (columnUpdateUpMigration.length === 0) {
    return;
  }

  let columnUpdateDownMigration = prepareUpdateColumnQuery({
    dataSource,
    schema,
    table,
    originalColumn: { id: column.name, ...column },
    column: originalColumn,
  });

  if (columnUpdateDownMigration.length === 0) {
    columnUpdateDownMigration = [
      {
        type: 'run_sql',
        args: {
          cascade: false,
          read_only: false,
          source: '',
          sql: getEmptyDownMigrationMessage(columnUpdateUpMigration),
        },
      },
    ];
  }

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `alter_table_${schema}_${table}_alter_column_${originalColumn.name}`,
      down: columnUpdateDownMigration,
      up: columnUpdateUpMigration,
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
