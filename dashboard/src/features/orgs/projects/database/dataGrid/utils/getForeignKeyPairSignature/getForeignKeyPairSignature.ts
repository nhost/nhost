/**
 * Builds an order-insensitive signature of a foreign key's column pairs so two
 * relations can be compared regardless of the order their pairs were declared
 * in, while still distinguishing different pairings of the same columns
 * (e.g. `a→x, b→y` is NOT equal to `a→y, b→x`).
 *
 * `columns[i]` is paired with `referencedColumns[i]`.
 *
 * @param columns - Local columns of the foreign key.
 * @param referencedColumns - Referenced columns, paired positionally with `columns`.
 * @returns A stable string signature usable for equality checks.
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
