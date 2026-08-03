import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import parseQueryResultJson from '@/features/orgs/projects/database/common/utils/parseQueryResultJson';
import {
  COLUMN_DEFINITION_QUERY,
  CONSTRAINT_DEFINITION_QUERY,
  MATERIALIZED_VIEW_COLUMN_DEFINITION_QUERY,
} from '@/features/orgs/projects/database/common/utils/sqlTemplates';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type {
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  QueryError,
  QueryResult,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  buildForeignKeyRelations,
  type RawTableConstraint,
} from '@/features/orgs/projects/database/dataGrid/utils/buildForeignKeyRelations';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

export interface FetchTableSchemaOptions extends MutationOrQueryBaseOptions {
  /**
   * The relation kind. Materialized views use a pg_attribute-based column
   * query instead of `information_schema.columns`.
   */
  tableType?: TableLikeObjectType;
}

export type FetchTableSchemaReturnType = Omit<
  FetchTableReturnType,
  'rows' | 'numberOfRows'
> & {
  /** Complete primary key, unique-constraint, and eligible unique-index sets. */
  constraintColumnSets: string[][];
};

/**
 * Fetch the schema of a table (columns and foreign key relations) without
 * fetching any row data.
 *
 * @param options - Options to use for the fetch call.
 * @returns The columns and foreign key relations of the table.
 */
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
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
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

  if (!tableDataResponse.ok || 'error' in responseData) {
    if ('internal' in responseData) {
      const queryError = responseData as QueryError;
      const schemaNotFound =
        POSTGRESQL_ERROR_CODES.SCHEMA_NOT_FOUND ===
        queryError.internal?.error?.status_code;
      const tableNotFound =
        POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND ===
        queryError.internal?.error?.status_code;

      if (schemaNotFound || tableNotFound) {
        return {
          columns: [],
          foreignKeyRelations: [],
          candidateKeys: [],
          uniqueConstraints: [],
          constraintColumnSets: [],
          error: null,
          metadata: { schema, table, schemaNotFound, tableNotFound },
        };
      }

      if (
        queryError.internal?.error?.status_code ===
        POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND
      ) {
        return {
          columns: [],
          foreignKeyRelations: [],
          candidateKeys: [],
          uniqueConstraints: [],
          constraintColumnSets: [],
          error: null,
          metadata: { schema, table, columnsNotFound: true },
        };
      }

      throw new Error(queryError.internal?.error?.message);
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      throw new Error(queryError.error);
    }
  }

  const [, ...rawColumns] = responseData[0].result;
  const [, ...rawConstraints] = responseData[1].result;

  const parsedColumns = rawColumns.map((rawColumn) =>
    parseQueryResultJson<NormalizedQueryDataRow>(rawColumn),
  );
  const parsedConstraints = rawConstraints.map((rawConstraint) =>
    parseQueryResultJson<RawTableConstraint>(rawConstraint),
  );

  const {
    foreignKeyRelations,
    foreignKeyRelationsByColumn,
    uniqueConstraintsByColumn,
    primaryConstraintsByColumn,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  } = buildForeignKeyRelations(parsedConstraints, schema);

  const columns = parsedColumns
    .map(
      (column) =>
        ({
          ...column,
          unique_constraints:
            uniqueConstraintsByColumn.get(column.column_name) || [],
          primary_constraints:
            primaryConstraintsByColumn.get(column.column_name) || [],
          foreign_key_relation:
            foreignKeyRelationsByColumn.get(column.column_name) || null,
        }) as NormalizedQueryDataRow,
    )
    .sort((a, b) => a.ordinal_position - b.ordinal_position);

  return {
    columns,
    foreignKeyRelations,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
    error: null,
  };
}
