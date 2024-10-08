import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';

export interface PrepareCreateForeignKeyRelationQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  /**
   * Data for the new foreign key relation.
   */
  foreignKeyRelation: ForeignKeyRelation;
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
}: PrepareCreateForeignKeyRelationQueryVariables) {
  return [
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
