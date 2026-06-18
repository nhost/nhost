import { areStrArraysEqual } from '@/lib/utils';

/**
 * The subset of a column we need to decide whether a foreign key is one-to-one.
 */
export interface ForeignKeyOneToOneColumn {
  name: string;
  /**
   * True only when this column alone is unique (the per-column Unique checkbox
   * in the table form). Must NOT be set for columns that merely participate in
   * a composite unique constraint or index, such as the `is_unique` flag
   * returned by `COLUMN_DEFINITION_QUERY` — pass the full constraint sets via
   * `constraintColumnSets` instead.
   */
  isUnique?: boolean;
  /**
   * True when the column is part of the primary key, composite included. The
   * flagged columns together form the fallback primary key column set.
   */
  isPrimary?: boolean;
}

export interface ComputeForeignKeyOneToOneContext {
  /**
   * Columns of the table that owns the foreign key.
   */
  columns: ForeignKeyOneToOneColumn[];
  /**
   * Column sets of every primary key / unique constraint on the table. Each
   * inner array is the set of columns covered by one constraint. Optional: when
   * absent (e.g. while creating a table that does not exist yet), the primary
   * key set derived from the per-column `isPrimary` flags is used instead.
   */
  constraintColumnSets?: string[][];
}

/**
 * Determines whether a foreign key is one-to-one. It is when the foreign key
 * column set equals the column set of a primary key / unique constraint on the
 * table — the same rule Hasura applies when suggesting relationships. A column
 * that is merely part of a composite primary key / unique constraint does not
 * make a single-column foreign key on it one-to-one.
 *
 * This is the single source of truth shared by the schema-fetch path
 * (`buildForeignKeyRelations`) and the table-editing form so that the
 * `oneToOne` flag submitted from the form matches the value recomputed on
 * refetch.
 *
 * @param foreignKeyColumns - Local columns of the foreign key.
 * @param context - The table's columns and constraint column sets.
 */
export default function computeForeignKeyOneToOne(
  foreignKeyColumns: string[],
  { columns, constraintColumnSets = [] }: ComputeForeignKeyOneToOneContext,
): boolean {
  if (foreignKeyColumns.length === 0) {
    return false;
  }

  const primaryKeyColumnSet = columns
    .filter((column) => column.isPrimary)
    .map((column) => column.name);

  const singleColumnUniqueSets = columns
    .filter((column) => column.isUnique)
    .map((column) => [column.name]);

  const candidateSets = [
    ...constraintColumnSets,
    ...singleColumnUniqueSets,
    ...(primaryKeyColumnSet.length > 0 ? [primaryKeyColumnSet] : []),
  ];

  return candidateSets.some(
    (columnSet) =>
      columnSet.length > 0 && areStrArraysEqual(columnSet, foreignKeyColumns),
  );
}
