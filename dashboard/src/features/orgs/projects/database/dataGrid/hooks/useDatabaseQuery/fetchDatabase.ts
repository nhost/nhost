import type {
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';

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
   * Response metadata.
   */
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
          metadata: { dataSource, databaseNotFound: true },
        };
      }

      throw new Error(queryError.error);
    }
  }

  const [, ...rawSchemas] = responseData[0].result;
  const [, ...rawTables] = responseData[1].result;

  return {
    schemas: rawSchemas.map((rawData) =>
      JSON.parse(rawData),
    ) as NormalizedQueryDataRow[],
    tables: rawTables.map((rawData) =>
      JSON.parse(rawData),
    ) as NormalizedQueryDataRow[],
  };
}
