import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getSingularForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

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
  const singularRelation = getSingularForeignKeyRelation(foreignKeyRelation);

  if (!singularRelation) {
    return [];
  }

  return [
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
