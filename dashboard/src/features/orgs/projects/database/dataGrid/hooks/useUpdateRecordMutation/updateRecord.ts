import { format } from 'node-pg-format';
import {
  getPreparedHasuraQuery,
  getPreparedReadOnlyHasuraQuery,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  AffectedRowsResult,
  ColumnUpdateOptions,
  DataBrowserColumnMetadata,
  DataBrowserGridRow,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { formatSelectList } from '@/features/orgs/projects/database/dataGrid/utils/formatSelectList';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import {
  formatSpatialValue,
  getSpatialType,
  isSpatialType,
} from '@/features/orgs/projects/database/dataGrid/utils/spatialTypeHelpers';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';

export interface UpdateRecordVariables<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
> {
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

export default async function updateRecord<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
>({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  row,
  columnsToUpdate,
}: UpdateRecordOptions & UpdateRecordVariables<TData>) {
  const allCells = row.getAllCells();
  const primaryKeys = allCells.filter(
    ({ column }) => column.columnDef.meta?.isPrimary,
  );

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

      if (reset === 'default') {
        return format('%I = DEFAULT', key);
      }

      if (reset === 'null') {
        return format('%I = NULL', key);
      }

      const col = allCells.find(
        ({ column }) =>
          (column.columnDef.meta as DataBrowserColumnMetadata)?.id === key,
      )!.column.columnDef.meta as DataBrowserColumnMetadata;

      if (col.isArray) {
        try {
          return format('%I = ARRAY[%L]', key, JSON.parse(value));
        } catch {
          throw new Error(
            `Invalid array value for column "${key}". Use JSON array format, e.g. [1, 2, 3].`,
          );
        }
      }

      const spatialType = getSpatialType(col.baseType);

      if (spatialType) {
        return format('%I = %s', key, formatSpatialValue(value, spatialType));
      }

      return format('%I = %L', key, value);
    })
    .join(', ');

  const selectList = formatSelectList(
    allCells
      .map(
        ({ column }) =>
          column.columnDef.meta as DataBrowserColumnMetadata | undefined,
      )
      .filter((meta): meta is DataBrowserColumnMetadata => Boolean(meta?.id))
      .map((meta) => ({
        name: meta.id,
        isSpatial: !meta.isArray && isSpatialType(meta.baseType),
      })),
  );

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
          'SELECT row_to_json(table_data) AS data FROM (SELECT %s FROM %I.%I WHERE %s LIMIT 1) table_data',
          selectList,
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
