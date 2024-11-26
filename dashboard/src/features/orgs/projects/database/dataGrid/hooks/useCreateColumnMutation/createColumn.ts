import type {
  AffectedRowsResult,
  DatabaseColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import prepareCreateColumnQuery from './prepareCreateColumnQuery';

export interface CreateColumnVariables {
  /**
   * The column to create.
   */
  column: DatabaseColumn;
}

export interface CreateColumnOptions extends MutationOrQueryBaseOptions {}

export default async function createColumn({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  column,
}: CreateColumnOptions & CreateColumnVariables) {
  const args = prepareCreateColumnQuery({
    dataSource,
    schema,
    table,
    column,
  });

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
