import type {
  ForeignKeyRelation,
  PostgresReferentialAction,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Extracts foreign key relation data from a raw foreign key constraint. This
 * function doesn't validate the constraint, it just extracts the data.
 *
 * @param name - Name of the constraint
 * @param rawConstraintDefinition - Raw foreign key constraint
 * @returns Foreign key relation data
 */
export default function extractForeignKeyRelation(
  name: string,
  rawConstraintDefinition: string,
): ForeignKeyRelation {
  const matches =
    /FOREIGN KEY (.*) REFERENCES (.*)(\(.*\))\s?(ON UPDATE (?:CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION))?\s?(ON DELETE (?:CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION))?/gi.exec(
      rawConstraintDefinition,
    );

  if (!matches) {
    return null;
  }

  const [
    ,
    columnName,
    referencedTablePath,
    referencedColumn,
    updateAction,
    deleteAction,
  ] = matches;

  // Referenced schema is unavailable if the constraint is related to a table in
  // the same schema as the table that contains the constraint.
  const [referencedSchema, referencedTable] =
    referencedTablePath?.split('.').length === 2
      ? referencedTablePath.split('.')
      : [null, referencedTablePath];

  return {
    name,
    columnName: columnName.replace(/(^\(|\)$)/gi, ''),
    referencedSchema,
    referencedTable,
    referencedColumn: referencedColumn.replace(/(^\(|\)$)/gi, ''),
    updateAction:
      (updateAction?.replace('ON UPDATE ', '') as PostgresReferentialAction) ||
      'NO ACTION',
    deleteAction:
      (deleteAction?.replace('ON DELETE ', '') as PostgresReferentialAction) ||
      'NO ACTION',
  };
}
