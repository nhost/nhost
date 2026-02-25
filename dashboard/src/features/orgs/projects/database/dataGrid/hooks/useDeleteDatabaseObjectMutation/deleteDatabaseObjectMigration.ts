import {
  getEmptyDownMigrationMessage,
  getPreparedHasuraQuery,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  AffectedRowsResult,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
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
  type: 'BASE TABLE';
}

export interface DeleteDatabaseObjectMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function deleteDatabaseObject({
  dataSource,
  adminSecret,
  schema,
  table,
  type,
}: DeleteDatabaseObjectMigrationOptions &
  DeleteDatabaseObjectMigrationVariables) {
  const deleteTableArgs = [
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
      name: `drop_table_${schema}_${table}`,
      down: [
        {
          type: 'run_sql',
          args: {
            cascade: false,
            read_only: false,
            source: '',
            sql: getEmptyDownMigrationMessage(deleteTableArgs),
          },
        },
      ],
      up: deleteTableArgs,
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
