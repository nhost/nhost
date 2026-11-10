/**
 * A foreign key is one-to-one exactly when its local columns contain a full
 * candidate key of the local table, so at most one local row can reference a
 * given referenced row. Per-column uniqueness cannot express this, because a
 * column may merely participate in a wider unique index.
 */
export default function computeForeignKeyOneToOne(
  foreignKeyColumns: string[],
  candidateKeyColumnSets: string[][],
): boolean {
  const foreignKeyColumnSet = new Set(foreignKeyColumns);

  return candidateKeyColumnSets.some(
    (candidateKeyColumns) =>
      candidateKeyColumns.length > 0 &&
      candidateKeyColumns.every((column) => foreignKeyColumnSet.has(column)),
  );
}
