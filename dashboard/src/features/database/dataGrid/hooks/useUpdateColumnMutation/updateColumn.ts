import type {
  AffectedRowsResult,
  DatabaseColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import prepareUpdateColumnQuery from './prepareUpdateColumnQuery';

export interface UpdateColumnVariables {
  /**
   * Original column.
   */
  originalColumn: DatabaseColumn;
  /**
   * Updated column data.
   */
  column: DatabaseColumn;
}

export interface UpdateColumnOptions extends MutationOrQueryBaseOptions {}

export default async function updateColumn({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  originalColumn,
  column,
}: UpdateColumnOptions & UpdateColumnVariables) {
  const args = prepareUpdateColumnQuery({
    dataSource,
    schema,
    table,
    originalColumn,
    column,
  });

  if (args.length === 0) {
    return;
  }

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
