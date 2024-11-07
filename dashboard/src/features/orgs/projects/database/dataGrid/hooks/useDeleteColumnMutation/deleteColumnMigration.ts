import { prepareCreateColumnQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateColumnMutation';
import type {
  AffectedRowsResult,
  DataBrowserGridColumn,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export interface DeleteColumnMigrationVariables {
  /**
   * Column to remove from the table.
   */
  column: DataBrowserGridColumn;
}

export interface DeleteColumnMigrationOptions
  extends MutationOrQueryBaseOptions {}

export default async function deleteColumnMigration({
  dataSource,
  schema,
  table,
  adminSecret,
  column,
}: DeleteColumnMigrationOptions & DeleteColumnMigrationVariables) {
  const recreateColumnArgs = prepareCreateColumnQuery({
    dataSource,
    schema,
    table,
    column: {
      ...column,
      name: column.id,
      type: {
        value: column.specificType,
        label: column.specificType,
      },
      defaultValue: {
        value: column.defaultValue,
        label: column.defaultValue,
        custom: column.isDefaultValueCustom,
      },
    },
  });

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `alter_table_${schema}_${table}_drop_column_${column.id}`,
      down: recreateColumnArgs,
      up: [
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I CASCADE',
          schema,
          table,
          column.id,
        ),
      ],
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
