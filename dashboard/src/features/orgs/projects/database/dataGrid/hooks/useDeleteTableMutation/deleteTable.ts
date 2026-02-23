import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

const typeToQuery = {
  'BASE TABLE': 'TABLE',
  VIEW: 'VIEW',
  'MATERIALIZED VIEW': 'MATERIALIZED VIEW',
};

export interface DeleteTableVariables {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table to delete.
   */
  table: string;
  /**
   *
   */
  type: 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW';
}

export interface DeleteTableOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function deleteTable({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  table,
  type,
}: DeleteTableOptions & DeleteTableVariables) {
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
