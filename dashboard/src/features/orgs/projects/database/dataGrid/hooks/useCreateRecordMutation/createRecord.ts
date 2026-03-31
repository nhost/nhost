import { format } from 'node-pg-format';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  AffectedRowsResult,
  ColumnInsertOptions,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

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
      const { value, fallbackValue, specificType } = columnValues[columnId];

      if (!value && fallbackValue) {
        return fallbackValue;
      }

      if (specificType?.endsWith('[]')) {
        try {
          return format('ARRAY[%L]', JSON.parse(value as string));
        } catch {
          throw new Error(
            `Invalid array value for column "${columnId}". Use JSON array format, e.g. [1, 2, 3].`,
          );
        }
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
