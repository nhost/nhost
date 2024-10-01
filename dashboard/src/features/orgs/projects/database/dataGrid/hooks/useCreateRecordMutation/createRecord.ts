import type {
  AffectedRowsResult,
  ColumnInsertOptions,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { format } from 'node-pg-format';

export interface CreateRecordVariables<TData extends object = {}> {
  /**
   * Column values to create.
   */
  columnValues: Record<keyof TData, ColumnInsertOptions>;
}

export interface CreateRecordOptions extends MutationOrQueryBaseOptions {}

export default async function createRecord<TData extends object = {}>({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  columnValues,
}: CreateRecordOptions & CreateRecordVariables<TData>) {
  const columnIds = Object.keys(columnValues);

  const columns = columnIds
    .map((columnId) => format('%I', columnId))
    .join(', ');

  const values = columnIds
    .map((columnId) => {
      const { value, fallbackValue } = columnValues[columnId];

      if (!value && fallbackValue) {
        return fallbackValue;
      }

      return format('%L', value);
    })
    .join(', ');

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedHasuraQuery(
          dataSource,
          'INSERT INTO %I.%I (%s) VALUES (%s)',
          schema,
          table,
          columns,
          values,
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
