import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { format } from 'node-pg-format';
import type { Row } from 'react-table';

export interface DeleteRecordVariables {
  /**
   * List of rows to delete.
   */
  selectedRows: Row[];
  /**
   * Name of the columns that are used as a primary key or are unique.
   */
  primaryOrUniqueColumns: string[];
}

export interface DeleteRecordOptions extends MutationOrQueryBaseOptions {}

export default async function deleteRecord({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  selectedRows,
  primaryOrUniqueColumns,
}: DeleteRecordOptions & DeleteRecordVariables) {
  if (primaryOrUniqueColumns.length === 0) {
    throw new Error(
      `You cannot delete rows from the table because it has no primary or unique key(s).`,
    );
  }

  const normalizedSelectedRows = selectedRows.map((row) => row.original);

  // First: We are preparing conditions for rows one by one.
  const rowConditions = normalizedSelectedRows.map(
    (row) =>
      `(${primaryOrUniqueColumns
        .map((primaryOrUniqueColumn) =>
          row[primaryOrUniqueColumn] === null
            ? format('%I IS NULL', primaryOrUniqueColumn)
            : format(
                '%I=%L',
                primaryOrUniqueColumn,
                row[primaryOrUniqueColumn],
              ),
        )
        .join(' AND ')})`,
  );

  // Second: We are connecting conditions of multiple rows in the WHERE
  // clause
  const whereClause = rowConditions.join(' OR ');

  const response = await fetch(`${appUrl}/v2/query`, {
    method: `POST`,
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedHasuraQuery(
          dataSource,
          'DELETE FROM %I.%I WHERE %s',
          schema,
          table,
          whereClause,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: AffectedRowsResult[] | QueryError = await response.json();

  if (response.ok) {
    return selectedRows.length;
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
