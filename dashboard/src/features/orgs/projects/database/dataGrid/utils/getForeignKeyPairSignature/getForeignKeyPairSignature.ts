import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Order-insensitive signature of a foreign key's column pairs (`columns[i]` →
 * `referencedColumns[i]`). Reordering the pairs keeps the signature; a
 * different pairing of the same columns changes it.
 */
export default function getForeignKeyPairSignature(
  columns: string[],
  referencedColumns: string[],
): string | null {
  if (
    columns.length === 0 ||
    columns.length !== referencedColumns.length ||
    columns.some((column) => column.length === 0) ||
    referencedColumns.some((column) => column.length === 0) ||
    new Set(columns).size !== columns.length ||
    new Set(referencedColumns).size !== referencedColumns.length
  ) {
    return null;
  }

  const pairs = columns
    .map((column, index) => [column, referencedColumns[index]] as const)
    .sort(
      (
        [leftColumn, leftReferencedColumn],
        [rightColumn, rightReferencedColumn],
      ) =>
        leftColumn.localeCompare(rightColumn) ||
        leftReferencedColumn.localeCompare(rightReferencedColumn),
    );

  return JSON.stringify(pairs);
}

export function areForeignKeyRelationsEqual(
  first: ForeignKeyRelation,
  second: ForeignKeyRelation,
): boolean {
  const firstSignature = getForeignKeyPairSignature(
    first.columns,
    first.referencedColumns,
  );
  const secondSignature = getForeignKeyPairSignature(
    second.columns,
    second.referencedColumns,
  );

  return (
    first.name === second.name &&
    first.referencedSchema === second.referencedSchema &&
    first.referencedTable === second.referencedTable &&
    firstSignature !== null &&
    firstSignature === secondSignature &&
    first.updateAction === second.updateAction &&
    first.deleteAction === second.deleteAction
  );
}
