import type {
  ForeignKeyRelation,
  PostgresReferentialAction,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const SUPPORTED_REFERENTIAL_ACTIONS: PostgresReferentialAction[] = [
  'NO ACTION',
  'RESTRICT',
  'CASCADE',
  'SET NULL',
  'SET DEFAULT',
];

export function isValidSingularForeignKeyRelation(
  relation: ForeignKeyRelation,
  currentColumnName: unknown,
): boolean {
  return (
    typeof relation.name === 'string' &&
    relation.name.length > 0 &&
    typeof relation.columnName === 'string' &&
    relation.columnName.length > 0 &&
    relation.columnName === currentColumnName &&
    typeof relation.referencedSchema === 'string' &&
    relation.referencedSchema.length > 0 &&
    typeof relation.referencedTable === 'string' &&
    relation.referencedTable.length > 0 &&
    typeof relation.referencedColumn === 'string' &&
    relation.referencedColumn.length > 0 &&
    SUPPORTED_REFERENTIAL_ACTIONS.includes(relation.updateAction) &&
    SUPPORTED_REFERENTIAL_ACTIONS.includes(relation.deleteAction)
  );
}

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
): ForeignKeyRelation | null {
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
    columnName: columnName.replace(/(^\(|\)$)/gi, '').replaceAll('"', ''),
    referencedSchema,
    referencedTable: referencedTable.replaceAll('"', ''),
    referencedColumn: referencedColumn
      .replace(/(^\(|\)$)/gi, '')
      .replaceAll('"', ''),
    updateAction:
      (updateAction?.replace('ON UPDATE ', '') as PostgresReferentialAction) ||
      'NO ACTION',
    deleteAction:
      (deleteAction?.replace('ON DELETE ', '') as PostgresReferentialAction) ||
      'NO ACTION',
  };
}
