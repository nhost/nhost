import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface FetchPostgresFunctionsOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export interface PostgresFunctionArgType {
  /** Schema where the argument's type is defined. */
  schema: string;
  /** Name of the argument's type. */
  name: string;
  /**
   * `pg_type.typtype` value: 'b' (base), 'c' (composite), 'd' (domain),
   * 'e' (enum), 'p' (pseudo), 'r' (range).
   */
  type: string;
}

export interface PostgresFunction {
  function_schema: string;
  function_name: string;
  function_arguments: string;
  function_definition: string;
  input_arg_types: PostgresFunctionArgType[];
}

export interface FetchPostgresFunctionsReturnType {
  functions: PostgresFunction[];
}

const SYSTEM_SCHEMAS = ['pg_%', 'hdb_%', 'information_schema'];

export default async function fetchPostgresFunctions({
  dataSource,
  appUrl,
  adminSecret,
}: FetchPostgresFunctionsOptions): Promise<FetchPostgresFunctionsReturnType> {
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
              n.nspname AS function_schema,
              p.proname AS function_name,
              pg_get_function_arguments(p.oid) AS function_arguments,
              pg_get_functiondef(p.oid) AS function_definition,
              (
                SELECT COALESCE(
                  json_agg(
                    json_build_object('schema', q.schema, 'name', q.name, 'type', q.type)
                    ORDER BY q.ordinality
                  ),
                  '[]'::json
                )
                FROM (
                  SELECT
                    pt.typname AS name,
                    pns.nspname AS schema,
                    pt.typtype::text AS type,
                    pat.ordinality
                  FROM unnest(COALESCE(p.proallargtypes, p.proargtypes::oid[]))
                    WITH ORDINALITY pat(oid, ordinality)
                  LEFT JOIN pg_type pt ON pt.oid = pat.oid
                  LEFT JOIN pg_namespace pns ON pt.typnamespace = pns.oid
                ) q
              ) AS input_arg_types
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE %s
              AND p.provariadic = 0
              AND p.provolatile IN ('s', 'i')
              AND NOT EXISTS (
                SELECT 1 FROM pg_aggregate
                WHERE pg_aggregate.aggfnoid::oid = p.oid
              )
            ORDER BY n.nspname ASC, p.proname ASC
          ) func_data`,
          SYSTEM_SCHEMAS.map((value) => `n.nspname NOT LIKE '${value}'`).join(
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
        return { functions: [] };
      }

      throw new Error(queryError.error);
    }
  }

  const [, ...rawFunctions] = responseData[0].result;

  return {
    functions: rawFunctions.map((rawData) =>
      JSON.parse(rawData),
    ) satisfies PostgresFunction[],
  };
}
