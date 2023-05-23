import { prepareCreateColumnQuery } from '@/features/database/dataGrid/hooks/useCreateColumnMutation';
import { prepareUpdateColumnQuery } from '@/features/database/dataGrid/hooks/useUpdateColumnMutation';
import type {
  DatabaseColumn,
  DatabaseTable,
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { prepareCreateForeignKeyRelationQuery } from '@/features/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';
import { prepareUpdateForeignKeyRelationQuery } from '@/features/database/dataGrid/utils/prepareUpdateForeignKeyRelationQuery';

export interface PrepareUpdateTableQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'table' | 'adminSecret'> {
  /**
   * Original table.
   */
  originalTable: NormalizedQueryDataRow;
  /**
   * Updated table data.
   */
  updatedTable: DatabaseTable;
  /**
   * Original columns of the table.
   */
  originalColumns: DatabaseColumn[];
  /**
   * Original foreign key relations.
   */
  originalForeignKeyRelations: ForeignKeyRelation[];
}

/**
 * Prepares SQL queries to update a table.
 *
 * @param options - Table information.
 * @returns SQL queries to create a column.
 */
export default function prepareUpdateTableQuery({
  dataSource,
  schema,
  originalTable,
  updatedTable,
  originalColumns,
  originalForeignKeyRelations,
}: PrepareUpdateTableQueryVariables) {
  let args: ReturnType<typeof getPreparedHasuraQuery>[] = [];

  const originalColumnMap = originalColumns.reduce(
    (map, column) => map.set(column.id, column),
    new Map<string, DatabaseColumn>(),
  );

  const updatedColumnMap = updatedTable.columns.reduce(
    (map, column) => map.set(column.id, column),
    new Map<string, DatabaseColumn>(),
  );

  const deletableColumns = originalColumns.filter(
    (column) => !updatedColumnMap.has(column.id),
  );

  if (deletableColumns.length > 0) {
    args = args.concat(
      ...deletableColumns.map((column) =>
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I',
          schema,
          originalTable.table_name,
          column.id,
        ),
      ),
    );
  }

  args = args.concat(
    ...updatedTable.columns.reduce((updatedArgs, column) => {
      const baseVariables = {
        dataSource,
        schema,
        table: originalTable.table_name,
        column: {
          ...column,
          isIdentity: updatedTable.identityColumn === column.name,
        },
        enableForeignKeys: false,
      };

      if (!column.id) {
        return [...updatedArgs, ...prepareCreateColumnQuery(baseVariables)];
      }

      const originalColumn = originalColumnMap.get(column.id);

      return [
        ...updatedArgs,
        ...prepareUpdateColumnQuery({
          ...baseVariables,
          originalColumn,
        }),
      ];
    }, []),
  );

  const currentPrimaryKey = originalColumns.find((column) => column.isPrimary);

  if (updatedTable?.primaryKey !== currentPrimaryKey?.id) {
    args = args.concat(
      ...(currentPrimaryKey?.primaryConstraints || []).map(
        (primaryConstraint) =>
          getPreparedHasuraQuery(
            dataSource,
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            schema,
            originalTable.table_name,
            primaryConstraint,
          ),
      ),
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ADD PRIMARY KEY (%I)',
        schema,
        originalTable.table_name,
        updatedTable.primaryKey,
      ),
    );
  }

  const updatedForeignKeyRelationMap = (
    updatedTable.foreignKeyRelations || []
  ).reduce(
    (map, foreignKeyRelation) =>
      map.set(foreignKeyRelation.name, foreignKeyRelation),
    new Map<string, ForeignKeyRelation>(),
  );

  const deletableForeignKeyRelations = originalForeignKeyRelations.filter(
    (foreignKeyRelation) =>
      !updatedForeignKeyRelationMap.has(foreignKeyRelation.name),
  );

  if (deletableForeignKeyRelations.length > 0) {
    args = args.concat(
      ...deletableForeignKeyRelations.map((foreignKeyRelation) =>
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
          schema,
          originalTable.table_name,
          foreignKeyRelation.name,
        ),
      ),
    );
  }

  if (updatedTable?.foreignKeyRelations?.length > 0) {
    const originalForeignKeyRelationMap = originalForeignKeyRelations.reduce(
      (map, foreignKeyRelation) =>
        map.set(foreignKeyRelation.name, foreignKeyRelation),
      new Map<string, ForeignKeyRelation>(),
    );

    args = args.concat(
      ...(updatedTable.foreignKeyRelations || []).reduce(
        (updatedArgs, foreignKeyRelation) => {
          const baseVariables = {
            dataSource,
            schema,
            table: originalTable.table_name,
            foreignKeyRelation,
          };

          if (!foreignKeyRelation.name) {
            return [
              ...updatedArgs,
              ...prepareCreateForeignKeyRelationQuery(baseVariables),
            ];
          }

          const originalForeignKeyRelation = originalForeignKeyRelationMap.get(
            foreignKeyRelation.name,
          );

          return [
            ...updatedArgs,
            ...prepareUpdateForeignKeyRelationQuery({
              ...baseVariables,
              originalForeignKeyRelation,
            }),
          ];
        },
        [],
      ),
    );
  }

  if (originalTable.table_name !== updatedTable.name) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I RENAME TO %I',
        schema,
        originalTable.table_name,
        updatedTable.name,
      ),
    );
  }

  return args;
}
