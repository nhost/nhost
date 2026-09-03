import { isCompleteColumnSet } from '@/features/orgs/projects/database/dataGrid/utils/isCompleteColumnSet';
import { isRecord } from '@/lib/utils';

interface ForeignKeyConstraintTable {
  name: string;
  schema: string;
}

export interface ParsedForeignKeyConstraintOn {
  columns: string[];
  table?: ForeignKeyConstraintTable;
}

function parseTable(value: unknown): ForeignKeyConstraintTable | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { name, schema } = value;
  return typeof name === 'string' &&
    name.length > 0 &&
    typeof schema === 'string' &&
    schema.length > 0
    ? { name, schema }
    : undefined;
}

/**
 * Normalizes every supported `foreign_key_constraint_on` shape while rejecting
 * empty, duplicate, ambiguous, and partially qualified values.
 */
export function parseForeignKeyConstraintOn(
  constraintOn: unknown,
): ParsedForeignKeyConstraintOn | undefined {
  if (typeof constraintOn === 'string') {
    return constraintOn.length > 0 ? { columns: [constraintOn] } : undefined;
  }

  if (Array.isArray(constraintOn)) {
    return isCompleteColumnSet(constraintOn)
      ? { columns: [...constraintOn] }
      : undefined;
  }

  if (!isRecord(constraintOn)) {
    return undefined;
  }

  const hasColumn = Object.hasOwn(constraintOn, 'column');
  const hasColumns = Object.hasOwn(constraintOn, 'columns');
  if (hasColumn === hasColumns) {
    return undefined;
  }

  const hasTable = Object.hasOwn(constraintOn, 'table');
  const table = hasTable ? parseTable(constraintOn.table) : undefined;
  if (hasTable && !table) {
    return undefined;
  }

  if (hasColumn) {
    const { column } = constraintOn;
    return typeof column === 'string' && column.length > 0
      ? { columns: [column], ...(table ? { table } : {}) }
      : undefined;
  }

  return isCompleteColumnSet(constraintOn.columns)
    ? {
        columns: [...constraintOn.columns],
        ...(table ? { table } : {}),
      }
    : undefined;
}

/**
 * Builds a `foreign_key_constraint_on` value: bare column(s) without `table`,
 * qualified `{ column(s), table }` with it; single columns use scalar forms.
 */
export function serializeForeignKeyConstraintOn(
  columns: readonly string[],
  table?: ForeignKeyConstraintTable,
) {
  if (!isCompleteColumnSet(columns) || (table && !parseTable(table))) {
    return undefined;
  }

  if (table) {
    if (columns.length === 1) {
      return { column: columns[0], table };
    }
    return { columns: [...columns], table };
  }
  if (columns.length === 1) {
    return columns[0];
  }
  return [...columns];
}
