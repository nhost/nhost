import {
  getEmptyDownMigrationMessage,
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
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import { typeToQuery } from './deleteDatabaseObject';

export interface DeleteDatabaseObjectMigrationVariables {
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
   * Function parameter types. Required when type is FUNCTION.
   */
  inputArgTypes?: FunctionParameter[];
}

export interface DeleteDatabaseObjectMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function deleteDatabaseObject({
  dataSource,
  adminSecret,
  schema,
  objectName,
  type,
  inputArgTypes,
}: DeleteDatabaseObjectMigrationOptions &
  DeleteDatabaseObjectMigrationVariables) {
  let deleteArgs: HasuraOperation[];
  if (type === 'FUNCTION') {
    const signature = buildFunctionSignature(
      schema,
      objectName,
      inputArgTypes || [],
    );
    const preparedQuery = getPreparedHasuraQuery(
      dataSource,
      'DROP FUNCTION IF EXISTS %s',
      signature,
    );
    deleteArgs = [
      { ...preparedQuery, args: { ...preparedQuery.args, cascade: false } },
    ];
  } else {
    deleteArgs = [
      getPreparedHasuraQuery(
        dataSource,
        `DROP ${typeToQuery[type]} IF EXISTS %I.%I`,
        schema,
        objectName,
      ),
    ];
  }

  const response = await fetch(`${getHasuraMigrationsApiUrl()}`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `drop_${type === 'FUNCTION' ? 'function' : 'table'}_${schema}_${objectName}`,
      down: [
        {
          type: 'run_sql',
          args: {
            cascade: false,
            read_only: false,
            source: '',
            sql: getEmptyDownMigrationMessage(deleteArgs),
          },
        },
      ],
      up: deleteArgs,
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
