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
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  prepareCreateUniqueConstraintQuery,
  prepareDropUniqueConstraintQuery,
  prepareUniqueConstraintDiffQueries,
} from '@/features/orgs/projects/database/dataGrid/utils/prepareUniqueConstraintQueries';
import { areStrArraysEqual, isNotEmptyValue } from '@/lib/utils';

export interface PrepareUpdateTableQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'table' | 'adminSecret'> {
  originalTableName: string;
  updatedTable: DatabaseTable;
  originalColumns: DatabaseColumn[];
  originalForeignKeyRelations: ForeignKeyRelation[];
}

function areForeignKeysEqual(
  first: ForeignKeyRelation,
  second: ForeignKeyRelation,
): boolean {
  return (
    first.name === second.name &&
    first.referencedSchema === second.referencedSchema &&
    first.referencedTable === second.referencedTable &&
    areStrArraysEqual(first.columns, second.columns) &&
    areStrArraysEqual(first.referencedColumns, second.referencedColumns) &&
    first.updateAction === second.updateAction &&
    first.deleteAction === second.deleteAction
  );
}

function prepareDropForeignKeyQuery(
  dataSource: string,
  schema: string,
  table: string,
  foreignKeyRelation: ForeignKeyRelation,
): HasuraOperation {
  return getPreparedHasuraQuery(
    dataSource,
    'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
    schema,
    table,
    foreignKeyRelation.name,
  );
}

function prepareAddForeignKeyQuery(
  dataSource: string,
  schema: string,
  table: string,
  foreignKeyRelation: ForeignKeyRelation,
): HasuraOperation {
  return getPreparedHasuraQuery(
    dataSource,
    'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON UPDATE %s ON DELETE %s',
    schema,
    table,
    foreignKeyRelation.name ??
      `${table}_${foreignKeyRelation.columns.join('_')}_fkey`,
    foreignKeyRelation.columns,
    foreignKeyRelation.referencedSchema || schema,
    foreignKeyRelation.referencedTable,
    foreignKeyRelation.referencedColumns,
    foreignKeyRelation.updateAction,
    foreignKeyRelation.deleteAction,
  );
}

function hasSameStableUniqueMembership(
  originalConstraint: UniqueConstraint,
  currentConstraint: UniqueConstraint,
  stableColumnNames: Map<string, string>,
): boolean {
  return areStrArraysEqual(
    originalConstraint.columns,
    currentConstraint.columns.map(
      (columnName) => stableColumnNames.get(columnName) ?? columnName,
    ),
  );
}

/** Prepares dependency-safe SQL operations to update a table. */
export default function prepareUpdateTableQuery({
  dataSource,
  schema,
  originalTableName,
  updatedTable,
  originalColumns,
  originalForeignKeyRelations,
}: PrepareUpdateTableQueryVariables) {
  const originalColumnMap = new Map(
    originalColumns.map((column) => [column.id as string, column]),
  );
  const updatedColumnMap = new Map(
    updatedTable.columns
      .filter((column) => column.id)
      .map((column) => [column.id as string, column]),
  );
  const stableColumnNames = new Map(
    updatedTable.columns.map((column) => [
      column.name,
      column.id ?? column.name,
    ]),
  );
  const typeChangedColumnNames = new Set(
    updatedTable.columns.flatMap((column) => {
      const originalColumn = column.id
        ? originalColumnMap.get(column.id)
        : undefined;
      return originalColumn && originalColumn.type !== column.type
        ? [originalColumn.name]
        : [];
    }),
  );

  const originalPrimaryKey = originalColumns
    .filter((column) => column.isPrimary)
    .map((column) => column.name);
  const stableUpdatedPrimaryKey = updatedTable.primaryKey.map(
    (columnName) => stableColumnNames.get(columnName) ?? columnName,
  );
  const hasPrimaryKeyChanged = !areStrArraysEqual(
    originalPrimaryKey,
    stableUpdatedPrimaryKey,
  );

  const originalUniqueConstraints =
    updatedTable.originalUniqueConstraints ?? [];
  const currentUniqueConstraints = updatedTable.uniqueConstraints ?? [];
  const originalUniqueConstraintsById = new Map(
    originalUniqueConstraints.map((constraint) => [constraint.id, constraint]),
  );
  const currentUniqueConstraintsById = new Map(
    currentUniqueConstraints.map((constraint) => [constraint.id, constraint]),
  );
  const droppedUniqueConstraints = originalUniqueConstraints.filter(
    (constraint) => {
      const current = currentUniqueConstraintsById.get(constraint.id);
      return (
        !current ||
        !hasSameStableUniqueMembership(constraint, current, stableColumnNames)
      );
    },
  );
  const addedUniqueConstraints = currentUniqueConstraints.filter(
    (constraint) => {
      const original = originalUniqueConstraintsById.get(constraint.id);
      return (
        !original ||
        !hasSameStableUniqueMembership(original, constraint, stableColumnNames)
      );
    },
  );
  const renameOnlyUniqueConstraints = currentUniqueConstraints.filter(
    (constraint) => {
      const original = originalUniqueConstraintsById.get(constraint.id);
      return (
        original &&
        hasSameStableUniqueMembership(original, constraint, stableColumnNames)
      );
    },
  );
  const renameOnlyOriginalConstraints = originalUniqueConstraints.filter(
    (constraint) =>
      renameOnlyUniqueConstraints.some(
        (current) => current.id === constraint.id,
      ),
  );
  const normalizedRenameConstraints = renameOnlyUniqueConstraints.map(
    (constraint) => ({
      ...constraint,
      columns: constraint.columns.map(
        (columnName) => stableColumnNames.get(columnName) ?? columnName,
      ),
    }),
  );
  const hasRebuiltSelfTableKey =
    hasPrimaryKeyChanged ||
    droppedUniqueConstraints.length > 0 ||
    addedUniqueConstraints.length > 0;

  const updatedForeignKeysByName = new Map(
    (updatedTable.foreignKeyRelations ?? [])
      .filter((relation) => relation.name)
      .map((relation) => [relation.name as string, relation]),
  );
  const foreignKeysToDrop: ForeignKeyRelation[] = [];
  const foreignKeysToAdd: ForeignKeyRelation[] = [];

  originalForeignKeyRelations.forEach((originalRelation) => {
    const currentRelation = originalRelation.name
      ? updatedForeignKeysByName.get(originalRelation.name)
      : undefined;
    const isChanged =
      !currentRelation ||
      !areForeignKeysEqual(originalRelation, currentRelation);
    const isSelfReference =
      (originalRelation.referencedSchema || schema) === schema &&
      originalRelation.referencedTable === originalTableName;
    const affectedByLocalTypeChange = originalRelation.columns.some((column) =>
      typeChangedColumnNames.has(column),
    );
    const affectedBySelfReferencedTypeChange =
      isSelfReference &&
      originalRelation.referencedColumns.some((column) =>
        typeChangedColumnNames.has(column),
      );
    const affectedByRebuiltSelfKey = isSelfReference && hasRebuiltSelfTableKey;

    if (
      isChanged ||
      affectedByLocalTypeChange ||
      affectedBySelfReferencedTypeChange ||
      affectedByRebuiltSelfKey
    ) {
      foreignKeysToDrop.push(originalRelation);
      if (currentRelation) {
        foreignKeysToAdd.push(currentRelation);
      }
    }
  });

  (updatedTable.foreignKeyRelations ?? []).forEach((relation) => {
    if (!relation.name) {
      foreignKeysToAdd.push(relation);
    }
  });

  const foreignKeyDropQueries = foreignKeysToDrop.map((relation) =>
    prepareDropForeignKeyQuery(dataSource, schema, originalTableName, relation),
  );

  const primaryKeyDropQueries: HasuraOperation[] = [];
  if (hasPrimaryKeyChanged) {
    const primaryConstraintNames = new Set(
      originalColumns.flatMap((column) => column.primaryConstraints ?? []),
    );
    primaryConstraintNames.forEach((constraintName) => {
      primaryKeyDropQueries.push(
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
          schema,
          originalTableName,
          constraintName,
        ),
      );
    });
  }

  const uniqueDropQueries = droppedUniqueConstraints.map((constraint) =>
    prepareDropUniqueConstraintQuery({
      dataSource,
      schema,
      table: originalTableName,
      uniqueConstraint: constraint,
    }),
  );

  const columnQueries: HasuraOperation[] = [];
  originalColumns
    .filter((column) => !updatedColumnMap.has(column.id as string))
    .forEach((column) => {
      columnQueries.push(
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I',
          schema,
          originalTableName,
          column.id,
        ),
      );
    });
  updatedTable.columns.forEach((column) => {
    const baseVariables = {
      dataSource,
      schema,
      table: originalTableName,
      column: {
        ...column,
        isIdentity: updatedTable.identityColumn === column.name,
      },
      enableForeignKeys: false,
      enableUniqueConstraints: false,
    };

    if (!column.id) {
      columnQueries.push(...prepareCreateColumnQuery(baseVariables));
      return;
    }

    const originalColumn = originalColumnMap.get(column.id);
    if (!originalColumn) {
      throw new Error(`Original column ${column.id} was not found.`);
    }

    columnQueries.push(
      ...prepareUpdateColumnQuery({
        ...baseVariables,
        originalColumn,
      }),
    );
  });

  const uniqueRenameQueries = prepareUniqueConstraintDiffQueries({
    dataSource,
    schema,
    table: originalTableName,
    uniqueConstraints: normalizedRenameConstraints,
    originalUniqueConstraints: renameOnlyOriginalConstraints,
  });

  const keyAddQueries: HasuraOperation[] = [];
  if (hasPrimaryKeyChanged && isNotEmptyValue(updatedTable.primaryKey)) {
    keyAddQueries.push(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ADD PRIMARY KEY (%s)',
        schema,
        originalTableName,
        updatedTable.primaryKey
          .map((column) => format('%I', column))
          .join(', '),
      ),
    );
  }
  keyAddQueries.push(
    ...addedUniqueConstraints.map((constraint) =>
      prepareCreateUniqueConstraintQuery({
        dataSource,
        schema,
        table: originalTableName,
        uniqueConstraint: constraint,
      }),
    ),
  );

  const foreignKeyAddQueries = foreignKeysToAdd.map((relation) =>
    prepareAddForeignKeyQuery(dataSource, schema, originalTableName, relation),
  );
  const tableRenameQueries =
    originalTableName === updatedTable.name
      ? []
      : [
          getPreparedHasuraQuery(
            dataSource,
            'ALTER TABLE %I.%I RENAME TO %I',
            schema,
            originalTableName,
            updatedTable.name,
          ),
        ];

  return [
    ...foreignKeyDropQueries,
    ...primaryKeyDropQueries,
    ...uniqueDropQueries,
    ...columnQueries,
    ...uniqueRenameQueries,
    ...keyAddQueries,
    ...foreignKeyAddQueries,
    ...tableRenameQueries,
  ];
}
