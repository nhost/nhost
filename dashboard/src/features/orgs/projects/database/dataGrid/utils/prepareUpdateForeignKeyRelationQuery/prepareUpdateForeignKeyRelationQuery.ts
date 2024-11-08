import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

export interface PrepareUpdateForeignKeyRelationQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  /**
   * Original foreign key relation.
   */
  originalForeignKeyRelation?: ForeignKeyRelation;
  /**
   * Data for the new foreign key relation.
   */
  foreignKeyRelation?: ForeignKeyRelation;
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
    originalForeignKeyRelation.columnName === foreignKeyRelation.columnName &&
    originalForeignKeyRelation.referencedSchema ===
      foreignKeyRelation.referencedSchema &&
    originalForeignKeyRelation.referencedTable ===
      foreignKeyRelation.referencedTable &&
    originalForeignKeyRelation.referencedColumn ===
      foreignKeyRelation.referencedColumn &&
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
      `${table}_${foreignKeyRelation.columnName}_fkey`,
      foreignKeyRelation.columnName,
      foreignKeyRelation.referencedSchema || schema,
      foreignKeyRelation.referencedTable,
      foreignKeyRelation.referencedColumn,
      foreignKeyRelation.updateAction,
      foreignKeyRelation.deleteAction,
    ),
  ];
}
