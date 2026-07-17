import { areStrArraysEqual } from '@/lib/utils';

export interface ForeignKeyOneToOneColumn {
  name: string;
  /**
   * True only when this column alone is unique (the per-column Unique checkbox
   * in the table form). Must NOT be set from flags like `is_unique`, which are
   * true for every member of a composite unique index — pass the full
   * constraint sets via `constraintColumnSets` instead.
   */
  isUnique?: boolean;
  /** True when the column is part of the primary key, composite included. */
  isPrimary?: boolean;
}

export interface ComputeForeignKeyOneToOneContext {
  /** Columns of the table that owns the foreign key. */
  columns?: ForeignKeyOneToOneColumn[];
  /**
   * Column sets of every primary key / unique constraint on the table. When
   * absent (e.g. while creating a table that does not exist yet), the primary
   * key set derived from the per-column `isPrimary` flags is used instead.
   */
  constraintColumnSets?: string[][];
}

/**
 * A foreign key is one-to-one when its column set equals the column set of a
 * primary key / unique constraint on the table. Single source of truth shared
 * by the schema-fetch path (`buildForeignKeyRelations`) and the table-editing
 * form so that both derive the same `oneToOne` flag.
 */
export default function computeForeignKeyOneToOne(
  foreignKeyColumns: string[],
  { columns = [], constraintColumnSets = [] }: ComputeForeignKeyOneToOneContext,
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
