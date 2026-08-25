import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { areForeignKeyRelationsEqual } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
import { prepareCreateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';

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
  if (!originalForeignKeyRelation?.name || !foreignKeyRelation) {
    return [];
  }

  if (
    areForeignKeyRelationsEqual(originalForeignKeyRelation, foreignKeyRelation)
  ) {
    return [];
  }

  const createQueries = prepareCreateForeignKeyRelationQuery({
    dataSource,
    schema,
    table,
    foreignKeyRelation,
    constraintName: foreignKeyRelation.name || originalForeignKeyRelation.name,
  });

  if (createQueries.length !== 1) {
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
    createQueries[0],
  ];
}
