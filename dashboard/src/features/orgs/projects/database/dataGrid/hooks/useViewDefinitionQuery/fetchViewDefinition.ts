import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface FetchViewDefinitionOptions
  extends MutationOrQueryBaseOptions {}

export interface FetchViewDefinitionReturnType {
  viewDefinition: string;
  viewType: 'VIEW' | 'MATERIALIZED VIEW';
  error: string | null;
}

export default async function fetchViewDefinition({
  dataSource,
  schema,
  table: viewName,
  appUrl,
  adminSecret,
}: FetchViewDefinitionOptions): Promise<FetchViewDefinitionReturnType> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT
            pg_get_viewdef(c.oid) AS view_definition,
            CASE WHEN c.relkind = 'v' THEN 'VIEW' ELSE 'MATERIALIZED VIEW' END AS view_type
          FROM pg_class c
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE n.nspname = %1$L AND c.relname = %2$L
            AND c.relkind IN ('v', 'm')
          LIMIT 1`,
          schema,
          viewName,
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
      return {
        viewDefinition: '',
        viewType: 'VIEW',
        error:
          queryError.internal?.error.message ||
          'Failed to fetch view definition.',
      };
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      return {
        viewDefinition: '',
        viewType: 'VIEW',
        error: queryError.error || 'Failed to fetch view definition.',
      };
    }
  }

  const [, ...rawResults] = responseData[0].result;

  if (rawResults.length === 0) {
    return {
      viewDefinition: '',
      viewType: 'VIEW',
      error: 'View definition not found.',
    };
  }

  const [viewDefinition, viewType] = rawResults[0];

  return {
    viewDefinition,
    viewType: viewType as 'VIEW' | 'MATERIALIZED VIEW',
    error: null,
  };
}
