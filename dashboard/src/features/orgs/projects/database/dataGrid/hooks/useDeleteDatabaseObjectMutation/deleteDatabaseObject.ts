import type { FunctionParameter } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';
import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

export const typeToQuery = {
  'BASE TABLE': 'TABLE',
  VIEW: 'VIEW',
  'MATERIALIZED VIEW': 'MATERIALIZED VIEW',
  FUNCTION: 'FUNCTION',
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
  type: 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW' | 'FUNCTION';
  /**
   * Function parameter types. Required when type is FUNCTION to uniquely
   * identify overloaded functions.
   */
  inputArgTypes?: FunctionParameter[];
}

export interface DeleteDatabaseObjectOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

function buildFunctionSignature(
  schema: string,
  name: string,
  inputArgTypes: FunctionParameter[],
): string {
  const formatParameterType = (param: FunctionParameter): string => {
    return param.schema
      ? `"${param.schema}"."${param.type}"`
      : `"${param.type}"`;
  };

  const parameterTypes = inputArgTypes.map(formatParameterType).join(', ');
  return parameterTypes
    ? `"${schema}"."${name}"(${parameterTypes})`
    : `"${schema}"."${name}"`;
}

export default async function deleteDatabaseObject({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  table,
  type,
  inputArgTypes,
}: DeleteDatabaseObjectOptions & DeleteDatabaseObjectVariables) {
  const isFunction = type === 'FUNCTION';

  const queryArgs = isFunction
    ? (() => {
        const signature = buildFunctionSignature(
          schema,
          table,
          inputArgTypes || [],
        );
        const preparedQuery = getPreparedHasuraQuery(
          dataSource,
          'DROP FUNCTION %s',
          signature,
        );
        return {
          ...preparedQuery,
          args: { ...preparedQuery.args, cascade: false },
        };
      })()
    : getPreparedHasuraQuery(
        dataSource,
        `DROP ${typeToQuery[type]} %I.%I`,
        schema,
        table,
      );

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [queryArgs],
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
