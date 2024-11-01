import type {
  AffectedRowsResult,
  DatabaseTable,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import prepareCreateTableQuery from './prepareCreateTableQuery';

export interface CreateTableVariables {
  /**
   * Table to create.
   */
  table: DatabaseTable;
}

export interface CreateTableOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function createTable({
  dataSource,
  schema,
  appUrl,
  adminSecret,
  table,
}: CreateTableOptions & CreateTableVariables) {
  const args = prepareCreateTableQuery({ dataSource, schema, table });

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args,
      type: 'bulk',
      version: 1,
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
