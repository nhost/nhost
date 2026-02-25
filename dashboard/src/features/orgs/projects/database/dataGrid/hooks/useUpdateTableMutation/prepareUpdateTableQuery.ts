import { format } from 'node-pg-format';
import {
  getPreparedHasuraQuery,
  type HasuraOperation,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import { prepareCreateColumnQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateColumnMutation';
import { prepareUpdateColumnQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateColumnMutation';
import type {
  DatabaseColumn,
  DatabaseTable,
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { prepareCreateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';
import { prepareUpdateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareUpdateForeignKeyRelationQuery';
import { areStrArraysEqual, isNotEmptyValue } from '@/lib/utils';

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
    (map, column) => map.set(column.id as string, column),
    new Map<string, DatabaseColumn>(),
  );

  const updatedColumnMap = updatedTable.columns.reduce(
    (map, column) => map.set(column.id as string, column),
    new Map<string, DatabaseColumn>(),
  );

  const deletableColumns = originalColumns.filter(
    (column) => !updatedColumnMap.has(column.id as string),
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
    ...updatedTable.columns.reduce<HasuraOperation[]>((updatedArgs, column) => {
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

      const originalColumn = originalColumnMap.get(column.id)!;

      return [
        ...updatedArgs,
        ...prepareUpdateColumnQuery({
          ...baseVariables,
          originalColumn,
        }),
      ];
    }, []),
  );

  const currentPrimaryKeys = originalColumns.filter(
    (column) => column.isPrimary,
  );

  const currentPrimaryKeyNames = currentPrimaryKeys.map((pk) => `${pk.name}`);
  const updatedPrimaryKeys = updatedTable.primaryKey;
  const hasPrimaryKeysChanged = !areStrArraysEqual(
    currentPrimaryKeyNames,
    updatedTable.primaryKey,
  );

  if (hasPrimaryKeysChanged) {
    const primaryKeyList = updatedTable.primaryKey
      .map((pk) => format('%I', pk))
      .join(', ');

    args = args.concat(
      ...currentPrimaryKeys
        .map((currentPrimaryKey) => currentPrimaryKey?.primaryConstraints || [])
        .map((primaryConstraint) =>
          getPreparedHasuraQuery(
            dataSource,
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            schema,
            originalTable.table_name,
            primaryConstraint,
          ),
        ),
    );
    if (isNotEmptyValue(updatedPrimaryKeys)) {
      args = args.concat(
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I ADD PRIMARY KEY (%s)',
          schema,
          originalTable.table_name,
          primaryKeyList,
        ),
      );
    }
  }

  const updatedForeignKeyRelationMap = (
    updatedTable.foreignKeyRelations || []
  ).reduce(
    (map, foreignKeyRelation) =>
      map.set(foreignKeyRelation.name as string, foreignKeyRelation),
    new Map<string, ForeignKeyRelation>(),
  );

  const deletableForeignKeyRelations = originalForeignKeyRelations.filter(
    (foreignKeyRelation) =>
      !updatedForeignKeyRelationMap.has(foreignKeyRelation.name as string),
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

  if (isNotEmptyValue(updatedTable?.foreignKeyRelations)) {
    const originalForeignKeyRelationMap = originalForeignKeyRelations.reduce(
      (map, foreignKeyRelation) =>
        map.set(foreignKeyRelation.name as string, foreignKeyRelation),
      new Map<string, ForeignKeyRelation>(),
    );

    args = args.concat(
      ...(updatedTable.foreignKeyRelations || []).reduce<HasuraOperation[]>(
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
