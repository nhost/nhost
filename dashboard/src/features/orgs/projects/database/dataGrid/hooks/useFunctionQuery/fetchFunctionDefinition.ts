import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

export interface FetchFunctionDefinitionOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {
  /**
   * Function name to fetch.
   */
  functionName: string;
}

export interface FunctionParameter {
  name: string | null;
  type: string;
  schema: string | null;
}

export interface FetchFunctionDefinitionReturnType {
  /**
   * The CREATE FUNCTION SQL definition.
   */
  functionDefinition: string;
  /**
   * Function metadata
   */
  functionMetadata: {
    functionName: string;
    functionSchema: string;
    functionType: 'IMMUTABLE' | 'STABLE' | 'VOLATILE' | null;
    returnTypeName: string;
    returnTypeSchema: string;
    returnsSet: boolean;
    language: string;
    parameters: FunctionParameter[];
    defaultArgsCount: number;
  } | null;
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
  functionName,
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
            SELECT 
              pg_get_functiondef(p.oid) as function_definition,
              p.proname::text as function_name,
              n.nspname::text as function_schema,
              CASE
                WHEN p.provolatile::text = 'i'::character(1)::text THEN 'IMMUTABLE'::text
                WHEN p.provolatile::text = 's'::character(1)::text THEN 'STABLE'::text
                WHEN p.provolatile::text = 'v'::character(1)::text THEN 'VOLATILE'::text
                ELSE NULL::text
              END AS function_type,
              rt.typname::text as return_type_name,
              rtn.nspname::text as return_type_schema,
              p.proretset as returns_set,
              l.lanname::text as language,
              (SELECT COALESCE(json_agg(json_build_object('name', pt.typname, 'schema', pns.nspname) ORDER BY pat.ordinality), '[]'::json)
               FROM unnest(COALESCE(p.proallargtypes, p.proargtypes::oid[])) WITH ORDINALITY pat(oid, ordinality)
               LEFT JOIN pg_type pt ON pt.oid = pat.oid
               LEFT JOIN pg_namespace pns ON pt.typnamespace = pns.oid) as input_arg_types,
              to_json(COALESCE(p.proargnames, ARRAY[]::text[])) as input_arg_names,
              p.pronargdefaults as default_args_count
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            JOIN pg_type rt ON rt.oid = p.prorettype
            JOIN pg_namespace rtn ON rtn.oid = rt.typnamespace
            JOIN pg_language l ON l.oid = p.prolang
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
        functionMetadata: null,
        error: queryError.internal?.error?.message || 'Unknown error occurred.',
      };
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      return {
        functionDefinition: '',
        functionMetadata: null,
        error: queryError.error || 'Unknown error occurred.',
      };
    }
  }

  const [, ...rawResults] = responseData[0].result;

  if (rawResults.length === 0) {
    return {
      functionDefinition: '',
      functionMetadata: null,
      error: 'Function definition not found.',
    };
  }

  const result = JSON.parse(rawResults[0]);
  const functionDefinition = result.function_definition || '';

  // Parse parameters
  const inputArgTypes: Array<{ name: string; schema: string }> =
    result.input_arg_types || [];
  const inputArgNames: string[] = result.input_arg_names || [];
  const defaultArgsCount: number = result.default_args_count || 0;

  const parameters: FunctionParameter[] = inputArgTypes.map(
    (argType, index) => ({
      name: inputArgNames[index] || null,
      type: argType.name,
      schema: argType.schema,
    }),
  );

  // Parameters with defaults are at the end, so required params are those before defaultArgsCount

  const functionMetadata = result.function_name
    ? {
        functionName: result.function_name,
        functionSchema: result.function_schema,
        functionType: result.function_type as
          | 'IMMUTABLE'
          | 'STABLE'
          | 'VOLATILE'
          | null,
        returnTypeName: result.return_type_name,
        returnTypeSchema: result.return_type_schema,
        returnsSet: result.returns_set === true,
        language: result.language,
        parameters,
        defaultArgsCount,
      }
    : null;

  return {
    functionDefinition,
    functionMetadata,
    error: null,
  };
}
