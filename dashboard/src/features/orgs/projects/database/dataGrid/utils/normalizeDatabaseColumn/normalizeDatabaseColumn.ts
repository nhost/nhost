import type {
  DatabaseColumn,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeColumnType } from '@/features/orgs/projects/database/dataGrid/utils/normalizeColumnType';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
/**
 * Converts a raw database column to a normalized database column.
 *
 * @param rawColumn - Raw database column.
 * @returns Normalized database column.
 */
export default function normalizeDatabaseColumn(
  rawColumn: NormalizedQueryDataRow,
): DatabaseColumn {
  const { normalizedDefaultValue, custom } = normalizeDefaultValue(
    rawColumn.column_default,
  );

  return {
    id: rawColumn.column_name,
    name: rawColumn.column_name,
    type: normalizeColumnType(rawColumn),
    isPrimary: rawColumn.is_primary,
    isIdentity: rawColumn.is_identity === 'YES',
    isGenerated: rawColumn.is_generated === 'ALWAYS',
    generationExpression: rawColumn.generation_expression ?? null,
    isNullable: rawColumn.is_nullable === 'YES',
    isUnique: rawColumn.is_unique,
    comment: rawColumn.column_comment || null,
    defaultValue: rawColumn.column_default
      ? { value: normalizedDefaultValue, custom }
      : null,
    uniqueConstraints: rawColumn.unique_constraints,
    primaryConstraints: rawColumn.primary_constraints,
    foreignKeyRelation: rawColumn.foreign_key_relation,
  };
}
