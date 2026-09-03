import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isCompleteForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

export interface PrepareCreateForeignKeyRelationQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  /**
   * Data for the new foreign key relation.
   */
  foreignKeyRelation: ForeignKeyRelation;
  /**
   * Overrides the generated `<table>_<columns>_fkey` constraint name.
   */
  constraintName?: string;
}

/**
 * Prepares SQL queries to create a foreign key relation.
 *
 * @param options - Database and foreign key relation information.
 * @returns SQL queries to create a foreign key relation.
 */
export default function prepareCreateForeignKeyRelationQuery({
  dataSource,
  schema,
  table,
  foreignKeyRelation,
  constraintName,
}: PrepareCreateForeignKeyRelationQueryVariables) {
  if (
    !isCompleteForeignKeyRelation(foreignKeyRelation) ||
    !(foreignKeyRelation.referencedSchema || schema)
  ) {
    return [];
  }

  return [
    getPreparedHasuraQuery(
      dataSource,
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON UPDATE %s ON DELETE %s',
      schema,
      table,
      constraintName || `${table}_${foreignKeyRelation.columns.join('_')}_fkey`,
      foreignKeyRelation.columns,
      foreignKeyRelation.referencedSchema || schema,
      foreignKeyRelation.referencedTable,
      foreignKeyRelation.referencedColumns,
      foreignKeyRelation.updateAction,
      foreignKeyRelation.deleteAction,
    ),
  ];
}
