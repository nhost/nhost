/**
 * A column carrying the per-column constraint-name arrays produced by the
 * schema fetch (`unique_constraints` / `primary_constraints`, normalized to
 * `uniqueConstraints` / `primaryConstraints`).
 */
export interface ConstraintColumn {
  name: string;
  uniqueConstraints?: string[];
  primaryConstraints?: string[];
}

/**
 * Reconstructs the primary key / unique constraint column sets from the
 * per-column constraint-name arrays. Columns sharing a constraint name are
 * grouped into a single set, reproducing the sets that the schema-fetch path
 * (`buildForeignKeyRelations`) derives from the raw constraint rows.
 *
 * @param columns - Columns carrying their unique/primary constraint names.
 * @returns One column set per constraint name.
 */
export default function deriveConstraintColumnSets(
  columns: ConstraintColumn[],
): string[][] {
  const columnsByConstraint = new Map<string, string[]>();

  columns.forEach((column) => {
    const constraintNames = [
      ...(column.uniqueConstraints ?? []),
      ...(column.primaryConstraints ?? []),
    ];

    constraintNames.forEach((constraintName) => {
      const existing = columnsByConstraint.get(constraintName);

      if (existing) {
        existing.push(column.name);
      } else {
        columnsByConstraint.set(constraintName, [column.name]);
      }
    });
  });

  return Array.from(columnsByConstraint.values());
}
