import type { CompleteKeyColumnSet } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface ForeignKeyOneToOneColumn {
  name: string;
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

function isCandidateKeySubset(
  candidateKey: string[],
  foreignKeyColumns: string[],
): boolean {
  if (
    !isCompleteColumnSet(candidateKey) ||
    !isCompleteColumnSet(foreignKeyColumns)
  ) {
    return false;
  }

  const foreignKeyColumnSet = new Set(foreignKeyColumns);
  return candidateKey.every((column) => foreignKeyColumnSet.has(column));
}

/**
 * A foreign key is one-to-one when its complete local column set contains a
 * complete primary, UNIQUE-constraint, or eligible unique-index set.
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
  const candidateSets = [
    ...constraintColumnSets,
    ...(primaryKeyColumnSet.length > 0 ? [primaryKeyColumnSet] : []),
  ];

  return candidateSets.some((columnSet) =>
    isCandidateKeySubset(columnSet, foreignKeyColumns),
  );
}
