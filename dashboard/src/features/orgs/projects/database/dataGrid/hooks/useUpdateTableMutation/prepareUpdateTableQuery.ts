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
  areForeignKeyRelationsEqual,
  getForeignKeyPairSignature,
} from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
import { prepareCreateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';
import {
  prepareCreateUniqueConstraintQuery,
  prepareDropUniqueConstraintQuery,
  prepareUniqueConstraintRenameQueries,
} from '@/features/orgs/projects/database/dataGrid/utils/prepareUniqueConstraintQueries';
import { areStrArraysEqual, isNotEmptyValue } from '@/lib/utils';

export interface PrepareUpdateTableQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'table' | 'adminSecret'> {
  /**
   * Original table name.
   */
  originalTableName: string;
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

function hasSameStableUniqueColumns(
  originalConstraint: UniqueConstraint,
  currentConstraint: UniqueConstraint,
  stableColumnNames: Map<string, string>,
): boolean {
  return (
    originalConstraint.columns.length === currentConstraint.columns.length &&
    currentConstraint.columns.every(
      (columnName, index) =>
        (stableColumnNames.get(columnName) ?? columnName) ===
        originalConstraint.columns[index],
    )
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
  const updatedForeignKeyRelations = updatedTable.foreignKeyRelations ?? [];
  if (
    updatedForeignKeyRelations.some(
      (relation) =>
        !relation.referencedTable ||
        !getForeignKeyPairSignature(
          relation.columns,
          relation.referencedColumns,
        ),
    )
  ) {
    return [];
  }

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
        !hasSameStableUniqueColumns(constraint, current, stableColumnNames)
      );
    },
  );
  const addedUniqueConstraints = currentUniqueConstraints.filter(
    (constraint) => {
      const original = originalUniqueConstraintsById.get(constraint.id);
      return (
        !original ||
        !hasSameStableUniqueColumns(original, constraint, stableColumnNames)
      );
    },
  );
  const renameOnlyUniqueConstraints = currentUniqueConstraints.filter(
    (constraint) => {
      const original = originalUniqueConstraintsById.get(constraint.id);
      return (
        original &&
        hasSameStableUniqueColumns(original, constraint, stableColumnNames)
      );
    },
  );
  const renameOnlyOriginalConstraints = renameOnlyUniqueConstraints.flatMap(
    (constraint) => originalUniqueConstraintsById.get(constraint.id) ?? [],
  );
  const hasRebuiltSelfTableKey =
    hasPrimaryKeyChanged ||
    droppedUniqueConstraints.length > 0 ||
    addedUniqueConstraints.length > 0;

  const updatedForeignKeysByName = new Map(
    updatedForeignKeyRelations
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
      !areForeignKeyRelationsEqual(originalRelation, currentRelation);
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

  updatedForeignKeyRelations.forEach((relation) => {
    if (!relation.name) {
      foreignKeysToAdd.push(relation);
    }
  });

  const foreignKeyDropQueries = foreignKeysToDrop.map((relation) =>
    getPreparedHasuraQuery(
      dataSource,
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      schema,
      originalTableName,
      relation.name,
    ),
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

  const uniqueRenameQueries = prepareUniqueConstraintRenameQueries({
    dataSource,
    schema,
    table: originalTableName,
    uniqueConstraints: renameOnlyUniqueConstraints,
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

  const isTableRenamed = originalTableName !== updatedTable.name;
  const tableRenameQueries = !isTableRenamed
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
  const foreignKeyAddQueries = foreignKeysToAdd.flatMap((relation) => {
    const referencedSchema = relation.referencedSchema || schema;
    const isSelfReference =
      referencedSchema === schema &&
      (relation.referencedTable === originalTableName ||
        relation.referencedTable === updatedTable.name);

    return prepareCreateForeignKeyRelationQuery({
      dataSource,
      schema,
      table: isTableRenamed ? updatedTable.name : originalTableName,
      foreignKeyRelation: isSelfReference
        ? { ...relation, referencedTable: updatedTable.name }
        : relation,
      constraintName: relation.name,
    });
  });

  return [
    ...foreignKeyDropQueries,
    ...primaryKeyDropQueries,
    ...uniqueDropQueries,
    ...columnQueries,
    ...uniqueRenameQueries,
    ...keyAddQueries,
    ...tableRenameQueries,
    ...foreignKeyAddQueries,
  ];
}
