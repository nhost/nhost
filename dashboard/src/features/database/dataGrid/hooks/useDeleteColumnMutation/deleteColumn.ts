import type {
  AffectedRowsResult,
  DataBrowserGridColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';

export interface DeleteColumnVariables {
  /**
   * Column to remove from the table.
   */
  column: DataBrowserGridColumn;
}

export interface DeleteColumnOptions extends MutationOrQueryBaseOptions {}

export default async function deleteColumn({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  column,
}: DeleteColumnOptions & DeleteColumnVariables) {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I CASCADE',
          schema,
          table,
          column.id,
        ),
      ],
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
