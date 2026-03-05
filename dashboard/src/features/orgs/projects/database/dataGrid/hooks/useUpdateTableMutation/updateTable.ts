import type {
  AffectedRowsResult,
  DatabaseColumn,
  DatabaseTable,
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import prepareUpdateTableQuery from './prepareUpdateTableQuery';

export interface UpdateTableVariables {
  /**
   * Original table name.
   */
  originalTableName: string;
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

export interface UpdateTableOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function updateTable({
  dataSource,
  schema,
  appUrl,
  adminSecret,
  originalTableName,
  originalColumns,
  originalForeignKeyRelations,
  updatedTable,
}: UpdateTableOptions & UpdateTableVariables) {
  const args = prepareUpdateTableQuery({
    dataSource,
    schema,
    originalTableName,
    updatedTable,
    originalForeignKeyRelations,
    originalColumns,
  });

  if (args.length === 0) {
    return;
  }

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args,
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
