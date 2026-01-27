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

export interface DeleteTableMigrationVariables {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table to delete.
   */
  table: string;
  /**
   * Type of the table to delete.
   */
  type: 'TABLE' | 'VIEW' | 'MATERIALIZED VIEW';
}

export interface DeleteTableMigration
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table' | 'type'> {}

export default async function deleteTable({
  dataSource,
  adminSecret,
  schema,
  table,
  type,
}: DeleteTableMigration & DeleteTableMigrationVariables) {
  const deleteTableArgs = [
    getPreparedHasuraQuery(
      dataSource,
      `DROP ${type} IF EXISTS %I.%I`,
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
