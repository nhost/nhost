import { isCompleteColumnSet } from '@/features/orgs/projects/database/dataGrid/utils/isCompleteColumnSet';

/**
 * Order-insensitive signature of a foreign key's column pairs (`columns[i]` →
 * `referencedColumns[i]`). Reordering the pairs keeps the signature; a
 * different pairing of the same columns changes it.
 */
export default function getForeignKeyPairSignature(
  columns: readonly string[],
  referencedColumns: readonly string[],
): string | null {
  if (
    !isCompleteColumnSet(columns) ||
    !isCompleteColumnSet(referencedColumns) ||
    columns.length !== referencedColumns.length
  ) {
    return null;
  }

  const columnPairs = columns.map(
    (column, index) => [column, referencedColumns[index]] as const,
  );
  columnPairs.sort(([leftColumn], [rightColumn]) =>
    leftColumn.localeCompare(rightColumn),
  );

  return JSON.stringify(columnPairs);
}
