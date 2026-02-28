import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

export const typeToQuery = {
  'BASE TABLE': 'TABLE',
} as const;

export interface DeleteDatabaseObjectVariables {
  /**
   * Schema where the database object is located.
   */
  schema: string;
  /**
   * Database object to delete.
   */
  table: string;
  /**
   * Type of the database object to delete.
   */
  type: 'BASE TABLE';
}

export interface DeleteDatabaseObjectOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function deleteDatabaseObject({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  table,
  type,
}: DeleteDatabaseObjectOptions & DeleteDatabaseObjectVariables) {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedHasuraQuery(
          dataSource,
          `DROP ${typeToQuery[type]} %I.%I`,
          schema,
          table,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: [AffectedRowsResult, QueryResult<string[]>] | QueryError =
    await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
