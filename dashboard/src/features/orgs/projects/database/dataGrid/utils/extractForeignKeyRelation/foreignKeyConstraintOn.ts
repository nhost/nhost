interface ForeignKeyConstraintTable {
  name: string;
  schema: string;
}

type ForeignKeyConstraintOnValue =
  | string
  | string[]
  | { column?: string; columns?: string[]; table?: ForeignKeyConstraintTable }
  | null
  | undefined;

export interface ParsedForeignKeyConstraintOn {
  columns: string[];
  table?: ForeignKeyConstraintTable;
}

function isValidColumns(columns: string[]): boolean {
  return (
    columns.length > 0 &&
    columns.every((column) => column.length > 0) &&
    new Set(columns).size === columns.length
  );
}

function isValidTable(
  table: ForeignKeyConstraintTable | undefined,
): table is ForeignKeyConstraintTable {
  return !!table?.name && !!table.schema;
}

/**
 * Normalizes the `foreign_key_constraint_on` union into `{ columns, table? }`.
 * `table` is only present for the qualified (object) forms.
 */
export function parseForeignKeyConstraintOn(
  constraintOn: ForeignKeyConstraintOnValue,
): ParsedForeignKeyConstraintOn | undefined {
  if (typeof constraintOn === 'string') {
    return constraintOn.length > 0 ? { columns: [constraintOn] } : undefined;
  }
  if (Array.isArray(constraintOn)) {
    return isValidColumns(constraintOn) ? { columns: constraintOn } : undefined;
  }
  if (!constraintOn) {
    return undefined;
  }
  if (constraintOn.table && !isValidTable(constraintOn.table)) {
    return undefined;
  }
  if (constraintOn.column !== undefined) {
    return constraintOn.column.length > 0
      ? { columns: [constraintOn.column], table: constraintOn.table }
      : undefined;
  }
  if (constraintOn.columns !== undefined) {
    return isValidColumns(constraintOn.columns)
      ? { columns: constraintOn.columns, table: constraintOn.table }
      : undefined;
  }
  return undefined;
}

/**
 * Builds a `foreign_key_constraint_on` value: bare column(s) without `table`,
 * qualified `{ column(s), table }` with it; single columns use scalar forms.
 */
export function serializeForeignKeyConstraintOn(
  columns: string[],
  table?: ForeignKeyConstraintTable,
) {
  if (!isValidColumns(columns) || (table && !isValidTable(table))) {
    return undefined;
  }

  if (table) {
    if (columns.length === 1) {
      return { column: columns[0], table };
    }
    return { columns, table };
  }
  if (columns.length === 1) {
    return columns[0];
  }
  return columns;
}
