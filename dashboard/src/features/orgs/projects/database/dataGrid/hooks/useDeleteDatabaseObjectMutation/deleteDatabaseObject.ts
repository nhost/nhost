import {
  getPreparedHasuraQuery,
  type HasuraOperation,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type { FunctionParameter } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';
import type {
  AffectedRowsResult,
  DatabaseObjectType,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { buildFunctionSignature } from '@/features/orgs/projects/database/dataGrid/utils/buildFunctionSignature';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';

export const typeToQuery: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'TABLE',
  VIEW: 'VIEW',
  'MATERIALIZED VIEW': 'MATERIALIZED VIEW',
  'FOREIGN TABLE': 'FOREIGN TABLE',
  FUNCTION: 'FUNCTION',
};

export interface DeleteDatabaseObjectVariables {
  /**
   * Schema where the database object is located.
   */
  schema: string;
  /**
   * Database object to delete.
   */
  objectName: string;
  /**
   * Type of the database object to delete.
   */
  type: DatabaseObjectType;
  /**
   * Function OID. Used to fetch parameter types when type is FUNCTION.
   */
  functionOID?: string;
  /**
   * Function parameter types. Required when type is FUNCTION to uniquely
   * identify overloaded functions.
   */
  inputArgTypes?: FunctionParameter[];
}

export interface DeleteDatabaseObjectOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function deleteDatabaseObject({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  objectName,
  type,
  inputArgTypes,
}: DeleteDatabaseObjectOptions & DeleteDatabaseObjectVariables) {
  const queryType = typeToQuery[type];
  if (!queryType) {
    throw new Error(`Unsupported database object type: ${type}`);
  }

  let queryArgs: HasuraOperation;
  if (type === 'FUNCTION') {
    const signature = buildFunctionSignature(
      schema,
      objectName,
      inputArgTypes || [],
    );
    const preparedQuery = getPreparedHasuraQuery(
      dataSource,
      `DROP ${queryType} %s`,
      signature,
    );
    queryArgs = {
      ...preparedQuery,
      args: { ...preparedQuery.args, cascade: false },
    };
  } else {
    queryArgs = getPreparedHasuraQuery(
      dataSource,
      `DROP ${queryType} %I.%I`,
      schema,
      objectName,
    );
  }

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
