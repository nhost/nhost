import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

export interface PrepareUpdateForeignKeyRelationQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  /**
   * Original foreign key relation.
   */
  originalForeignKeyRelation?: ForeignKeyRelation | null;
  /**
   * Data for the new foreign key relation.
   */
  foreignKeyRelation?: ForeignKeyRelation | null;
}

/**
 * Prepares SQL queries to update a foreign key relation.
 *
 * @param options - Database and foreign key relation information.
 * @returns SQL queries to update a foreign key relation.
 */
export default function prepareUpdateForeignKeyRelationQuery({
  dataSource,
  schema,
  table,
  originalForeignKeyRelation,
  foreignKeyRelation,
}: PrepareUpdateForeignKeyRelationQueryVariables) {
  if (!originalForeignKeyRelation || !foreignKeyRelation) {
    return [];
  }

  if (
    originalForeignKeyRelation.name === foreignKeyRelation.name &&
    originalForeignKeyRelation.referencedSchema ===
      foreignKeyRelation.referencedSchema &&
    originalForeignKeyRelation.referencedTable ===
      foreignKeyRelation.referencedTable &&
    getForeignKeyPairSignature(
      originalForeignKeyRelation.columns,
      originalForeignKeyRelation.referencedColumns,
    ) ===
      getForeignKeyPairSignature(
        foreignKeyRelation.columns,
        foreignKeyRelation.referencedColumns,
      ) &&
    originalForeignKeyRelation.deleteAction ===
      foreignKeyRelation.deleteAction &&
    originalForeignKeyRelation.updateAction === foreignKeyRelation.updateAction
  ) {
    return [];
  }

  return [
    getPreparedHasuraQuery(
      dataSource,
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      schema,
      table,
      originalForeignKeyRelation.name,
    ),
    getPreparedHasuraQuery(
      dataSource,
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON UPDATE %s ON DELETE %s',
      schema,
      table,
      `${table}_${foreignKeyRelation.columns.join('_')}_fkey`,
      foreignKeyRelation.columns,
      foreignKeyRelation.referencedSchema || schema,
      foreignKeyRelation.referencedTable,
      foreignKeyRelation.referencedColumns,
      foreignKeyRelation.updateAction,
      foreignKeyRelation.deleteAction,
    ),
  ];
}
