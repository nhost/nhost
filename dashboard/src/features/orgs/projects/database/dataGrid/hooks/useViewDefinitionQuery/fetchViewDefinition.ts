import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

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
          `SELECT row_to_json(view_data) as data FROM (
            SELECT
              CASE WHEN pg_has_role(c.relowner, 'USAGE') THEN pg_get_viewdef(c.oid) ELSE null END AS view_definition,
              CASE WHEN c.relkind = 'v' THEN 'VIEW' ELSE 'MATERIALIZED VIEW' END AS view_type
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = %1$L AND c.relname = %2$L
              AND c.relkind IN ('v', 'm')
              AND (pg_has_role(c.relowner, 'USAGE')
                OR has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                OR has_any_column_privilege(c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))
            LIMIT 1
          ) view_data`,
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
        error: queryError.internal?.error.message || 'Failed to fetch view definition.',
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

  const result = JSON.parse(rawResults[0]);
  const viewDefinition = result.view_definition || '';
  const viewType = (result.view_type || 'VIEW') as 'VIEW' | 'MATERIALIZED VIEW';

  return {
    viewDefinition,
    viewType,
    error: null,
  };
}
