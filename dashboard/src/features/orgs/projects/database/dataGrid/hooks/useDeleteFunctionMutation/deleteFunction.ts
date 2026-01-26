import type { FunctionParameter } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';
import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

export interface DeleteFunctionVariables {
  /**
   * Schema where the function is located.
   */
  schema: string;
  /**
   * Function to delete.
   */
  functionName: string;
  /**
   * Function parameter types. Required to uniquely identify the function
   * when dropping it, especially for overloaded functions.
   */
  inputArgTypes: FunctionParameter[];
}

export interface DeleteFunctionOptions
  extends Omit<MutationOrQueryBaseOptions, 'table' | 'schema'> {}

export default async function deleteFunction({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  functionName,
  inputArgTypes,
}: DeleteFunctionOptions & DeleteFunctionVariables) {
  // Construct the function signature with parameter types
  // Format: DROP FUNCTION "schema"."function_name"("type_schema"."type_name", ...)
  const formatParameterType = (param: FunctionParameter): string => {
    return param.schema
      ? `"${param.schema}"."${param.type}"`
      : `"${param.type}"`;
  };

  const parameterTypes = inputArgTypes.map(formatParameterType).join(', ');
  const functionSignature = parameterTypes
    ? `"${schema}"."${functionName}"(${parameterTypes})`
    : `"${schema}"."${functionName}"`;

  // Use getPreparedHasuraQuery for SQL formatting, then override cascade to false
  // (getPreparedHasuraQuery defaults to cascade: true, but we need false)
  const preparedQuery = getPreparedHasuraQuery(
    dataSource,
    'DROP FUNCTION %s',
    functionSignature,
  );

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        {
          ...preparedQuery,
          args: {
            ...preparedQuery.args,
            cascade: false,
          },
        },
      ],
      type: 'bulk',
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
