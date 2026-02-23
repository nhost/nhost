import type { FunctionParameter } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';
import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  getEmptyDownMigrationMessage,
  getPreparedHasuraQuery,
} from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
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
  table: string;
  /**
   * Type of the database object to delete.
   */
  type: 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW' | 'FUNCTION';
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
  table,
  type,
  inputArgTypes,
}: DeleteDatabaseObjectMigrationOptions &
  DeleteDatabaseObjectMigrationVariables) {
  const isFunction = type === 'FUNCTION';

  const buildFunctionSignature = (): string => {
    const formatParameterType = (param: FunctionParameter): string => {
      return param.schema
        ? `"${param.schema}"."${param.type}"`
        : `"${param.type}"`;
    };

    const params = (inputArgTypes || []).map(formatParameterType).join(', ');
    return params
      ? `"${schema}"."${table}"(${params})`
      : `"${schema}"."${table}"`;
  };

  const deleteArgs = isFunction
    ? [
        (() => {
          const signature = buildFunctionSignature();
          const preparedQuery = getPreparedHasuraQuery(
            dataSource,
            'DROP FUNCTION IF EXISTS %s',
            signature,
          );
          return {
            ...preparedQuery,
            args: { ...preparedQuery.args, cascade: false },
          };
        })(),
      ]
    : [
        getPreparedHasuraQuery(
          dataSource,
          `DROP ${typeToQuery[type]} IF EXISTS %I.%I`,
          schema,
          table,
        ),
      ];

  const response = await fetch(`${getHasuraMigrationsApiUrl()}`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `drop_${isFunction ? 'function' : 'table'}_${schema}_${table}`,
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
