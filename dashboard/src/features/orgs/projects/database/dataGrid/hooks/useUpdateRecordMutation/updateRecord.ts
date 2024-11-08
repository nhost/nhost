import type {
  AffectedRowsResult,
  ColumnUpdateOptions,
  DataBrowserGridRow,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  getPreparedHasuraQuery,
  getPreparedReadOnlyHasuraQuery,
} from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { format } from 'node-pg-format';

export interface UpdateRecordVariables<TData extends object = {}> {
  /**
   * Table row to update.
   */
  row: DataBrowserGridRow<TData>;
  /**
   * Columns to update.
   */
  columnsToUpdate: Record<keyof TData, ColumnUpdateOptions>;
}

export interface UpdateRecordOptions extends MutationOrQueryBaseOptions {}

export default async function updateRecord<TData extends object = {}>({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  row,
  columnsToUpdate,
}: UpdateRecordOptions & UpdateRecordVariables<TData>) {
  const primaryKeys = row.cells.filter(({ column }) => column.isPrimary);

  if (primaryKeys.length === 0) {
    throw new Error('No primary keys found for row.');
  }

  const primaryKeyConditions = primaryKeys
    .map(({ column: { id } }) => {
      const columnId = id.toString();
      const value = row.original[columnId];

      // WHERE clause for NULL conditions is a bit different
      if (value === null) {
        return format('%I IS NULL', columnId);
      }

      return format('%I=%L', columnId, value);
    })
    .join(' AND ');

  const updatableColumns = Object.keys(columnsToUpdate)
    .map((key) => {
      const { value, reset } = columnsToUpdate[key];

      if (reset) {
        return format('%I = NULL', key);
      }

      return format('%I = %L', key, value);
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
          'UPDATE %I.%I SET %s WHERE %s',
          schema,
          table,
          updatableColumns,
          primaryKeyConditions,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          'SELECT row_to_json(table_data) as data FROM %I.%I table_data WHERE %s LIMIT 1',
          schema,
          table,
          primaryKeyConditions,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: [AffectedRowsResult, QueryResult<string[]>] | QueryError =
    await response.json();

  if (response.ok) {
    const [, selectResult] = responseData as [
      AffectedRowsResult,
      QueryResult<string[]>,
    ];
    const [, ...rawData] = selectResult.result;
    const mappedData: TData[] = rawData.map((rawRow) => JSON.parse(rawRow));

    if (mappedData.length === 1) {
      return { ...row, original: mappedData[0] };
    }

    return { ...row, original: { ...row.original, ...columnsToUpdate } };
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
