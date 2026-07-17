/**
 * Order-insensitive signature of a foreign key's column pairs (`columns[i]` →
 * `referencedColumns[i]`). Reordering the pairs keeps the signature; a
 * different pairing of the same columns changes it.
 */
export default function getForeignKeyPairSignature(
  columns: string[],
  referencedColumns: string[],
): string {
  return columns
    .map((column, index) => `${column}→${referencedColumns[index] ?? ''}`)
    .sort()
    .join('|');
}
