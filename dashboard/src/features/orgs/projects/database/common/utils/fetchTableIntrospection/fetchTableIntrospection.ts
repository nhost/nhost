import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import {
  type ParsedTableColumnsAndConstraints,
  parseTableColumnsAndConstraints,
} from '@/features/orgs/projects/database/common/utils/parseTableColumnsAndConstraints';
import {
  COLUMN_DEFINITION_QUERY,
  CONSTRAINT_DEFINITION_QUERY,
  MATERIALIZED_VIEW_COLUMN_DEFINITION_QUERY,
} from '@/features/orgs/projects/database/common/utils/sqlTemplates';
import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

export interface FetchTableIntrospectionOptions
  extends MutationOrQueryBaseOptions {
  /** Materialized views use a pg_attribute-based column query. */
  tableType?: TableLikeObjectType;
}

export interface FetchTableMetadata {
  schema?: string;
  table?: string;
  schemaNotFound?: boolean;
  tableNotFound?: boolean;
  columnsNotFound?: boolean;
}

export type FetchTableIntrospectionResult =
  | { kind: 'parsed'; parsed: ParsedTableColumnsAndConstraints }
  | { kind: 'missing'; metadata: FetchTableMetadata };

export function isQueryError(payload: unknown): payload is QueryError {
  return typeof payload === 'object' && payload !== null && 'error' in payload;
}

export function createEmptyTableIntrospection(): ParsedTableColumnsAndConstraints {
  return {
    columns: [],
    foreignKeyRelations: [],
    candidateKeys: [],
    uniqueConstraints: [],
    constraintColumnSets: [],
  };
}

/** Fetch and parse column and constraint metadata for a table-like object. */
export default async function fetchTableIntrospection({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  tableType,
}: FetchTableIntrospectionOptions): Promise<FetchTableIntrospectionResult> {
  const columnDefinitionQuery =
    tableType === 'MATERIALIZED VIEW'
      ? MATERIALIZED_VIEW_COLUMN_DEFINITION_QUERY
      : COLUMN_DEFINITION_QUERY;
  const response = await fetch(`${appUrl}/v2/query`, {
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
    await response.json();

  if (!response.ok || isQueryError(responseData)) {
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
          kind: 'missing',
          metadata: { schema, table, schemaNotFound, tableNotFound },
        };
      }

      if (
        responseData.internal.error?.status_code ===
        POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND
      ) {
        return {
          kind: 'missing',
          metadata: { schema, table, columnsNotFound: true },
        };
      }

      throw new Error(responseData.internal.error?.message);
    }

    throw new Error(responseData.error);
  }

  const [, ...rawColumns] = responseData[0].result;
  const [, ...rawConstraints] = responseData[1].result;

  return {
    kind: 'parsed',
    parsed: parseTableColumnsAndConstraints(rawColumns, rawConstraints),
  };
}
