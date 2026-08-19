import type { CompleteKeyColumnSet } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface ForeignKeyOneToOneColumn {
  name: string;
  /** True only when this column alone has a complete UNIQUE constraint. */
  isUnique?: boolean;
  /** True when the column is part of the table's complete primary key. */
  isPrimary?: boolean;
}

export interface ComputeForeignKeyOneToOneContext {
  columns?: ForeignKeyOneToOneColumn[];
  /** Complete primary, UNIQUE-constraint, and eligible unique-index sets. */
  constraintColumnSets?: CompleteKeyColumnSet[];
}

function isCompleteColumnSet(columns: string[]): boolean {
  return (
    columns.length > 0 &&
    columns.every((column) => column.length > 0) &&
    new Set(columns).size === columns.length
  );
}

function areExactSetsEqual(left: string[], right: string[]): boolean {
  if (
    left.length !== right.length ||
    !isCompleteColumnSet(left) ||
    !isCompleteColumnSet(right)
  ) {
    return false;
  }

  const rightColumns = new Set(right);
  return left.every((column) => rightColumns.has(column));
}

/**
 * A foreign key is one-to-one only when its complete local column set exactly
 * equals a complete primary, UNIQUE-constraint, or eligible unique-index set.
 */
export default function computeForeignKeyOneToOne(
  foreignKeyColumns: string[],
  { columns = [], constraintColumnSets = [] }: ComputeForeignKeyOneToOneContext,
): boolean {
  if (!isCompleteColumnSet(foreignKeyColumns)) {
    return false;
  }

  const primaryKeyColumnSet = columns
    .filter((column) => column.isPrimary)
    .map((column) => column.name);
  const singletonUniqueSets = columns
    .filter((column) => column.isUnique)
    .map((column) => [column.name]);
  const candidateSets = [
    ...constraintColumnSets,
    ...singletonUniqueSets,
    ...(primaryKeyColumnSet.length > 0 ? [primaryKeyColumnSet] : []),
  ];

  return candidateSets.some((columnSet) =>
    areExactSetsEqual(columnSet, foreignKeyColumns),
  );
}
