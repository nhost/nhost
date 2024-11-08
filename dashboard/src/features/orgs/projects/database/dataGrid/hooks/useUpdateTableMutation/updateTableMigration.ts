import type {
  AffectedRowsResult,
  DatabaseColumn,
  DatabaseTable,
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getEmptyDownMigrationMessage } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import prepareUpdateTableQuery from './prepareUpdateTableQuery';

export interface UpdateTableMigrationVariables {
  /**
   * Original table.
   */
  originalTable: NormalizedQueryDataRow;
  /**
   * Original columns of the table.
   */
  originalColumns: DatabaseColumn[];
  /**
   * Original foreign key relations.
   */
  originalForeignKeyRelations: ForeignKeyRelation[];
  /**
   * Updated table data.
   */
  updatedTable: DatabaseTable;
}

export interface UpdateTableMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function updateTableMigration({
  dataSource,
  schema,
  adminSecret,
  originalTable,
  originalColumns,
  originalForeignKeyRelations,
  updatedTable,
}: UpdateTableMigrationOptions & UpdateTableMigrationVariables) {
  const args = prepareUpdateTableQuery({
    dataSource,
    schema,
    originalTable,
    updatedTable,
    originalForeignKeyRelations,
    originalColumns,
  });

  if (args.length === 0) {
    return;
  }

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `alter_table_${schema}_${originalTable.table_name}`,
      down: [
        {
          type: 'run_sql',
          args: {
            cascade: false,
            read_only: false,
            source: '',
            sql: getEmptyDownMigrationMessage(args),
          },
        },
      ],
      up: args,
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
