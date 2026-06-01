import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

export interface RefreshMaterializedViewVariables {
  /**
   * Schema where the materialized view is located.
   */
  schema: string;
  /**
   * Materialized view to refresh.
   */
  table: string;
}

export interface RefreshMaterializedViewOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function refreshMaterializedView({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  table,
}: RefreshMaterializedViewOptions & RefreshMaterializedViewVariables) {
  const queryArgs = getPreparedHasuraQuery(
    dataSource,
    'REFRESH MATERIALIZED VIEW %I.%I',
    schema,
    table,
  );

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify(queryArgs),
  });

  const responseData: QueryResult<string[]> | QueryError =
    await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
