import { formatWithArray } from 'node-pg-format';
import {
  createEmptyTableIntrospection,
  type FetchTableMetadata,
  fetchTableIntrospection,
} from '@/features/orgs/projects/database/common/utils/fetchTableIntrospection';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import { parseQueryResultJson } from '@/features/orgs/projects/database/common/utils/parseQueryResultJson';
import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { DEFAULT_ROWS_LIMIT } from '@/features/orgs/projects/database/dataGrid/constants';
import { buildDefaultOrderByClause } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/buildDefaultOrderByClause';
import { filtersToWhere } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/filtersToWhere';
import type {
  CandidateKey,
  CompleteKeyColumnSet,
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  OrderBy,
  QueryError,
  QueryResult,
  TableLikeObjectType,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function isQueryError(payload: unknown): payload is QueryError {
  return typeof payload === 'object' && payload !== null && 'error' in payload;
}

export interface FetchTableOptions extends MutationOrQueryBaseOptions {
  limit?: number;
  offset?: number;
  orderBy?: OrderBy[];
  filters?: DataGridFilter[];
  /** Materialized views use a pg_attribute-based column query. */
  tableType?: TableLikeObjectType;
}

export interface FetchTableReturnType {
  columns: NormalizedQueryDataRow[];
  rows: NormalizedQueryDataRow[];
  error: string | null;
  foreignKeyRelations: ForeignKeyRelation[];
  candidateKeys: CandidateKey[];
  uniqueConstraints: UniqueConstraint[];
  constraintColumnSets: CompleteKeyColumnSet[];
  numberOfRows: number;
  metadata?: FetchTableMetadata;
}

/** Fetch the available columns and rows of a table. */
export default async function fetchTable({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  limit,
  offset,
  orderBy,
  filters,
  tableType,
}: FetchTableOptions): Promise<FetchTableReturnType> {
  let limitAndOffsetClause = '';

  if (limit && offset) {
    limitAndOffsetClause = `LIMIT ${limit} OFFSET ${offset}`;
  } else if (limit) {
    limitAndOffsetClause = `LIMIT ${limit}`;
  } else {
    limitAndOffsetClause = `LIMIT ${DEFAULT_ROWS_LIMIT}`;
  }

  let orderByClause = '';
  if (orderBy && orderBy.length > 0) {
    const pgFormatTemplate = orderBy.map(() => '%I %s').join(' ');
    const flattenedOrderByValues = orderBy.reduce<OrderBy[]>(
      (values, currentOrderBy) => [
        ...values,
        ...(Object.values(currentOrderBy) as OrderBy[]),
      ],
      [],
    );

    orderByClause = formatWithArray(
      `ORDER BY ${pgFormatTemplate}`,
      flattenedOrderByValues,
    );
  }

  const whereClause = filtersToWhere(filters);
  const introspection = await fetchTableIntrospection({
    dataSource,
    schema,
    table,
    appUrl,
    adminSecret,
    tableType,
  });

  if (introspection.kind === 'missing') {
    return {
      ...createEmptyTableIntrospection(),
      rows: [],
      error: null,
      numberOfRows: 0,
      metadata: introspection.metadata,
    };
  }

  const {
    columns,
    foreignKeyRelations,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  } = introspection.parsed;

  if (!orderByClause) {
    orderByClause = buildDefaultOrderByClause(columns, tableType);
  }

  const rowDataResponse = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: { 'x-hasura-admin-secret': adminSecret },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(TABLE_DATA) FROM (SELECT * FROM %I.%I %s %s %s) TABLE_DATA`,
          schema,
          table,
          whereClause,
          orderByClause,
          limitAndOffsetClause,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT COUNT(*) FROM %I.%I %s`,
          schema,
          table,
          whereClause,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });
  const rawData: QueryResult<string[]> | QueryError =
    await rowDataResponse.json();

  if (!rowDataResponse.ok && isQueryError(rawData)) {
    return {
      columns,
      rows: [],
      error:
        rawData.internal?.error.message ??
        'Something went wrong while fetching the table rows.',
      foreignKeyRelations,
      candidateKeys,
      uniqueConstraints,
      constraintColumnSets,
      numberOfRows: 0,
    };
  }

  const [, ...rowData] = rawData[0].result as string[];
  const [, [rowAggregate]] = rawData[1].result as string[];

  return {
    columns,
    rows: rowData.map((row) =>
      parseQueryResultJson<NormalizedQueryDataRow>(row),
    ),
    error: null,
    foreignKeyRelations,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
    numberOfRows: Number.parseInt(rowAggregate, 10) || 0,
  };
}
