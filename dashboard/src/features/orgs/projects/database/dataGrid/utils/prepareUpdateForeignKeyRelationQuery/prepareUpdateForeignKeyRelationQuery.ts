import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getSingularForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

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

  const originalSingularRelation = getSingularForeignKeyRelation(
    originalForeignKeyRelation,
  );
  const singularRelation = getSingularForeignKeyRelation(foreignKeyRelation);

  if (!originalSingularRelation || !singularRelation) {
    return [];
  }

  if (
    originalForeignKeyRelation.name === foreignKeyRelation.name &&
    originalSingularRelation.localColumn === singularRelation.localColumn &&
    originalForeignKeyRelation.referencedSchema ===
      foreignKeyRelation.referencedSchema &&
    originalForeignKeyRelation.referencedTable ===
      foreignKeyRelation.referencedTable &&
    originalSingularRelation.remoteColumn === singularRelation.remoteColumn &&
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
      `${table}_${singularRelation.localColumn}_fkey`,
      singularRelation.localColumn,
      foreignKeyRelation.referencedSchema || schema,
      foreignKeyRelation.referencedTable,
      singularRelation.remoteColumn,
      foreignKeyRelation.updateAction,
      foreignKeyRelation.deleteAction,
    ),
  ];
}
