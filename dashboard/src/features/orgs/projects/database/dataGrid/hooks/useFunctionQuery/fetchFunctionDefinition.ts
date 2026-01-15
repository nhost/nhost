import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

export interface FetchFunctionDefinitionOptions
  extends MutationOrQueryBaseOptions {}

export interface FetchFunctionDefinitionReturnType {
  /**
   * The CREATE FUNCTION SQL definition.
   */
  functionDefinition: string;
  /**
   * Error message if any.
   */
  error: string | null;
}

/**
 * Fetch the CREATE FUNCTION SQL definition for a table-returning function.
 *
 * @param options - Options to use for the fetch call.
 * @returns The function definition SQL.
 */
export default async function fetchFunctionDefinition({
  dataSource,
  schema,
  table: functionName,
  appUrl,
  adminSecret,
}: FetchFunctionDefinitionOptions): Promise<FetchFunctionDefinitionReturnType> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT row_to_json(func_data) as data FROM (
            SELECT pg_get_functiondef(p.oid) as function_definition
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = %1$L AND p.proname = %2$L
            LIMIT 1
          ) func_data`,
          schema,
          functionName,
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
        functionDefinition: '',
        error: queryError.internal?.error?.message || 'Unknown error occurred.',
      };
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      return {
        functionDefinition: '',
        error: queryError.error || 'Unknown error occurred.',
      };
    }
  }

  const [, ...rawResults] = responseData[0].result;

  if (rawResults.length === 0) {
    return {
      functionDefinition: '',
      error: 'Function definition not found.',
    };
  }

  const result = JSON.parse(rawResults[0]);
  const functionDefinition = result.function_definition || '';

  return {
    functionDefinition,
    error: null,
  };
}
