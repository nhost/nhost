import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridFilterProvider';
import type {
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  OrderBy,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { isNotEmptyValue } from '@/lib/utils';

export interface FetchTableRowsOptions extends MutationOrQueryBaseOptions {
  /**
   * Name of the columns to fetch
   */
  columnNames: string[];
  /**
   * Limit of rows to fetch.
   */
  limit: number;
  /**
   * Offset of rows to fetch.
   */
  offset: number;
  /**
   * Ordering configuration.
   *
   * @default []
   */
  orderBy: OrderBy[];
  /**
   * Filtering configuration.
   *
   * @default []
   */
  filters: DataGridFilter[];
}

export type FetchTableRowsResult = {
  error?: string | null;
  rows: NormalizedQueryDataRow[];
  numberOfRows: number;
};

function createRowQuery({
  columnNames,
  limit,
  offset,
  orderBy,
  filters,
  schema,
  table,
  dataSource,
}: FetchTableRowsOptions) {
  return {
    type: 'select',
    args: {
      source: dataSource,
      table: { schema, name: table },
      columns: columnNames,
      // TODO: create function
      where: {
        $and: filters?.map(({ column, op, value }) => ({
          [column]: {
            [op]: op === '$in' || op === '$nin' ? JSON.parse(value) : value,
          },
        })),
      },
      offset,
      limit,
      order_by:
        orderBy?.map((ob) => ({
          column: ob.columnName,
          type: ob.mode.toLocaleLowerCase(),
        })) ?? [],
    },
  };
}

async function fetchTableRows({
  columnNames,
  limit,
  offset,
  orderBy,
  filters,
  adminSecret,
  dataSource,
  appUrl,
  table,
  schema,
}: FetchTableRowsOptions): Promise<FetchTableRowsResult> {
  const body = {
    type: 'bulk',
    args: [
      createRowQuery({
        columnNames,
        limit,
        offset,
        orderBy,
        filters,
        dataSource,
        table,
        schema,
        appUrl,
        adminSecret,
      }),
      getPreparedReadOnlyHasuraQuery(
        dataSource,
        `SELECT COUNT(*) FROM %I.%I`,
        schema,
        table,
      ),
    ],
  };
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json();

  if (isNotEmptyValue(responseBody.error)) {
    return {
      rows: [],
      error: responseBody.error,
      numberOfRows: 0,
    };
  }

  const [
    rows,
    {
      result: [, [maxNumberOfRows]],
    },
  ] = responseBody;

  return {
    rows,
    error: null,
    numberOfRows: isNotEmptyValue(filters)
      ? rows.length
      : Number(maxNumberOfRows),
  };
}

export default fetchTableRows;
