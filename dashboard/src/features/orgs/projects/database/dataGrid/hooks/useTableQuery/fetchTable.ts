import { formatWithArray } from 'node-pg-format';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import { parseQueryResultJson } from '@/features/orgs/projects/database/common/utils/parseQueryResultJson';
import { parseTableColumnsAndConstraints } from '@/features/orgs/projects/database/common/utils/parseTableColumnsAndConstraints';
import {
  COLUMN_DEFINITION_QUERY,
  CONSTRAINT_DEFINITION_QUERY,
  MATERIALIZED_VIEW_COLUMN_DEFINITION_QUERY,
} from '@/features/orgs/projects/database/common/utils/sqlTemplates';
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
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

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

interface FetchTableMetadata {
  schema?: string;
  table?: string;
  schemaNotFound?: boolean;
  tableNotFound?: boolean;
  columnsNotFound?: boolean;
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

function emptyIntrospectionResult() {
  return {
    columns: [],
    rows: [],
    error: null,
    numberOfRows: 0,
    foreignKeyRelations: [],
    candidateKeys: [],
    uniqueConstraints: [],
    constraintColumnSets: [],
  } satisfies Omit<FetchTableReturnType, 'metadata'>;
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
  const columnDefinitionQuery =
    tableType === 'MATERIALIZED VIEW'
      ? MATERIALIZED_VIEW_COLUMN_DEFINITION_QUERY
      : COLUMN_DEFINITION_QUERY;
  const tableDataResponse = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: { 'x-hasura-admin-secret': adminSecret },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          columnDefinitionQuery,
          schema,
          table,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          CONSTRAINT_DEFINITION_QUERY,
          schema,
          table,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });
  const responseData: QueryResult<string[]>[] | QueryError =
    await tableDataResponse.json();

  if (!tableDataResponse.ok || isQueryError(responseData)) {
    if (!isQueryError(responseData)) {
      throw new Error('Something went wrong while fetching the table schema.');
    }

    if (responseData.internal) {
      const schemaNotFound =
        POSTGRESQL_ERROR_CODES.SCHEMA_NOT_FOUND ===
        responseData.internal.error?.status_code;
      const tableNotFound =
        POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND ===
        responseData.internal.error?.status_code;

      if (schemaNotFound || tableNotFound) {
        return {
          ...emptyIntrospectionResult(),
          metadata: { schema, table, schemaNotFound, tableNotFound },
        };
      }

      if (
        responseData.internal.error?.status_code ===
        POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND
      ) {
        return {
          ...emptyIntrospectionResult(),
          metadata: { schema, table, columnsNotFound: true },
        };
      }

      throw new Error(responseData.internal.error?.message);
    }

    throw new Error(responseData.error);
  }

  const [, ...rawColumns] = responseData[0].result;
  const [, ...rawConstraints] = responseData[1].result;
  const {
    columns,
    foreignKeyRelations,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  } = parseTableColumnsAndConstraints(rawColumns, rawConstraints, schema);

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
