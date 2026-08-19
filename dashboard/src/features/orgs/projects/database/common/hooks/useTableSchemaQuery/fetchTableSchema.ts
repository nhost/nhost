import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import { parseTableColumnsAndConstraints } from '@/features/orgs/projects/database/common/utils/parseTableColumnsAndConstraints';
import {
  COLUMN_DEFINITION_QUERY,
  CONSTRAINT_DEFINITION_QUERY,
  MATERIALIZED_VIEW_COLUMN_DEFINITION_QUERY,
} from '@/features/orgs/projects/database/common/utils/sqlTemplates';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

export interface FetchTableSchemaOptions extends MutationOrQueryBaseOptions {
  /** Materialized views use a pg_attribute-based column query. */
  tableType?: TableLikeObjectType;
}

export type FetchTableSchemaReturnType = Omit<
  FetchTableReturnType,
  'rows' | 'numberOfRows'
>;

function isQueryError(payload: unknown): payload is QueryError {
  return typeof payload === 'object' && payload !== null && 'error' in payload;
}

function emptySchemaResult() {
  return {
    columns: [],
    foreignKeyRelations: [],
    candidateKeys: [],
    uniqueConstraints: [],
    constraintColumnSets: [],
    error: null,
  } satisfies Omit<FetchTableSchemaReturnType, 'metadata'>;
}

/** Fetch table columns, complete relations, and candidate-key metadata. */
export default async function fetchTableSchema({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  tableType,
}: FetchTableSchemaOptions): Promise<FetchTableSchemaReturnType> {
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
          ...emptySchemaResult(),
          metadata: { schema, table, schemaNotFound, tableNotFound },
        };
      }

      if (
        responseData.internal.error?.status_code ===
        POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND
      ) {
        return {
          ...emptySchemaResult(),
          metadata: { schema, table, columnsNotFound: true },
        };
      }

      throw new Error(responseData.internal.error?.message);
    }

    throw new Error(responseData.error);
  }

  const [, ...rawColumns] = responseData[0].result;
  const [, ...rawConstraints] = responseData[1].result;
  const parsed = parseTableColumnsAndConstraints(
    rawColumns,
    rawConstraints,
    schema,
  );

  return { ...parsed, error: null };
}
