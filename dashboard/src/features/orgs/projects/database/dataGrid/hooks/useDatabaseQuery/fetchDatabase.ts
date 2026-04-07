import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  FunctionObject,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  QueryError,
  QueryResult,
  TableLikeObject,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface FetchDatabaseOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export interface FetchDatabaseReturnType {
  /**
   * List of available schemas in the database.
   */
  schemas?: NormalizedQueryDataRow[];
  /**
   * List of available table-like objects in the database: tables, views, enums...
   */
  tableLikeObjects?: TableLikeObject[];
  /**
   * List of available table-returning functions in the database.
   */
  functions?: FunctionObject[];
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
          `SELECT row_to_json(obj_data) as data FROM (SELECT n.nspname AS table_schema, c.relname AS table_name, CASE c.relkind WHEN 'r' THEN 'ORDINARY TABLE' WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'f' THEN 'FOREIGN TABLE' END AS table_type, pg_relation_is_updatable(c.oid, true) AS updatability FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r', 'v', 'm', 'f') AND %s) obj_data ORDER BY table_name ASC`,
          SYSTEM_TABLES.map((value) => `n.nspname NOT LIKE '${value}'`).join(
            ' AND ',
          ),
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT row_to_json(func_data) as data FROM (
            SELECT
              n.nspname as function_schema,
              p.proname as function_name,
              p.oid as function_oid
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            JOIN pg_type ON p.prorettype = pg_type.oid
            WHERE n.nspname NOT LIKE 'pg_%'
              AND n.nspname != 'information_schema'
              AND pg_type.typtype ='c'
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
          tableLikeObjects: [],
          functions: [],
          metadata: { dataSource, databaseNotFound: true },
        };
      }

      throw new Error(queryError.error);
    }
  }

  const [, ...rawSchemas] = responseData[0].result;
  const [, ...rawTableLikeObjects] = responseData[1].result;
  const [, ...rawFunctions] = responseData[2].result;

  return {
    schemas: rawSchemas.map((rawData) =>
      JSON.parse(rawData),
    ) as NormalizedQueryDataRow[],
    tableLikeObjects: rawTableLikeObjects.map((rawData) =>
      JSON.parse(rawData),
    ) as TableLikeObject[],
    functions: rawFunctions.map((rawData) =>
      JSON.parse(rawData),
    ) satisfies FunctionObject[],
  };
}
