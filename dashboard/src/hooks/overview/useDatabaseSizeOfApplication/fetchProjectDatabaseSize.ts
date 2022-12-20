import type { QueryError, QueryResult } from '@/types/dataBrowser';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import normalizeQueryError from '@/utils/dataBrowser/normalizeQueryError';

export interface FetchProjectDatabaseSizeOptions {
  /**
   * Project subdomain.
   */
  subdomain: string;
  /**
   * Project region.
   */
  region: string;
  /**
   * Admin secret for the project.
   */
  adminSecret: string;
}

export interface FetchProjectDatabaseSizeReturnType {
  databaseSize: number;
}

/**
 * Fetch the database size of a project.
 *
 * @param options - Options to use for the fetch call.
 * @returns The available schemas and tables.
 */
export default async function fetchProjectDatabaseSize({
  subdomain,
  region,
  adminSecret,
}: FetchProjectDatabaseSizeOptions): Promise<FetchProjectDatabaseSizeReturnType> {
  const response = await fetch(
    `${generateAppServiceUrl(subdomain, region, 'hasura')}/v2/query`,
    {
      method: 'POST',
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        type: 'run_sql',
        args: {
          sql: `SELECT pg_database_size('${
            subdomain === 'localhost' ? 'postgres' : subdomain
          }');`,
        },
      }),
    },
  );

  const responseData: QueryResult<string[]> | QueryError =
    await response.json();

  if (response.ok) {
    return {
      databaseSize: parseInt(
        (responseData as QueryResult<string[]>).result[1][0],
        10,
      ),
    };
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
