import type {
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  NormalizedQueryFunctionRow,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

export interface FetchDatabaseOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export interface FetchDatabaseReturnType {
  /**
   * List of available schemas in the database.
   */
  schemas?: NormalizedQueryDataRow[];
  /**
   * List of available tables in the database.
   */
  tables?: NormalizedQueryDataRow[];
  /**
   * List of available views in the database.
   */
  views?: NormalizedQueryDataRow[];
  /**
   * List of available materialized views in the database.
   */
  materializedViews?: NormalizedQueryDataRow[];
  /**
   * List of available table-returning functions in the database.
   */
  functions?: NormalizedQueryFunctionRow[];
  /**
   * Response metadata.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  metadata?: Record<string, any>;
}

const SYSTEM_TABLES = ['pg_%', 'hdb_%', 'information_schema'];

/**
 * Fetch the available schemas and tables of the current data source.
 *
 * @param options - Options to use for the fetch call.
 * @returns The available schemas and tables.
 */
export default async function fetchDatabase({
  dataSource,
  appUrl,
  adminSecret,
}: FetchDatabaseOptions): Promise<FetchDatabaseReturnType> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT row_to_json(table_data) as data FROM information_schema.schemata table_data WHERE %s ORDER BY schema_name ASC`,
          SYSTEM_TABLES.map((value) => `schema_name NOT LIKE '${value}'`).join(
            ' AND ',
          ),
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT row_to_json(table_data) as data FROM information_schema.tables table_data WHERE %s ORDER BY table_name ASC`,
          SYSTEM_TABLES.map((value) => `table_schema NOT LIKE '${value}'`).join(
            ' AND ',
          ),
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT row_to_json(mv_data) as data FROM (SELECT schemaname as table_schema, matviewname as table_name, 'MATERIALIZED VIEW' as table_type FROM pg_matviews WHERE %s) mv_data ORDER BY table_name ASC`,
          SYSTEM_TABLES.map((value) => `schemaname NOT LIKE '${value}'`).join(
            ' AND ',
          ),
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT row_to_json(func_data) as data FROM (
            SELECT 
              n.nspname as table_schema,
              p.proname as table_name,
              'FUNCTION' as table_type
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname NOT LIKE 'pg_%'
              AND n.nspname != 'information_schema'
              AND p.prokind = 'f'
              AND p.proretset = true
            ORDER BY p.proname ASC
          ) func_data`,
          '',
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: QueryResult<string[]>[] | QueryError =
    await response.json();

  if (!response.ok || 'error' in responseData) {
    if ('internal' in responseData) {
      const queryError = responseData as QueryError;
      throw new Error(
        queryError.internal?.error?.message || 'Unknown error occurred.',
      );
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;

      if (queryError.code === 'not-exists') {
        return {
          schemas: [],
          tables: [],
          views: [],
          materializedViews: [],
          functions: [],
          metadata: { dataSource, databaseNotFound: true },
        };
      }

      throw new Error(queryError.error);
    }
  }

  const [, ...rawSchemas] = responseData[0].result;
  const [, ...rawTables] = responseData[1].result;
  const [, ...rawMaterializedViews] = responseData[2].result;
  const [, ...rawFunctions] = responseData[3].result;

  // Parse all tables data
  const allTables = rawTables.map((rawData) =>
    JSON.parse(rawData),
  ) as NormalizedQueryDataRow[];

  // Separate base tables from views based on table_type
  const tables = allTables.filter(
    (table) => table.table_type === 'BASE TABLE',
  );
  const views = allTables.filter((table) => table.table_type === 'VIEW');

  return {
    schemas: rawSchemas.map((rawData) =>
      JSON.parse(rawData),
    ) as NormalizedQueryDataRow[],
    tables,
    views,
    materializedViews: rawMaterializedViews.map((rawData) =>
      JSON.parse(rawData),
    ) as NormalizedQueryDataRow[],
    functions: rawFunctions.map((rawData) =>
      JSON.parse(rawData),
    ) satisfies NormalizedQueryFunctionRow[],
  };
}
