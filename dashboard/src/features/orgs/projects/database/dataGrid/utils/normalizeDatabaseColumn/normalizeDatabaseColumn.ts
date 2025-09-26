import type {
  DatabaseColumn,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';

import { normalizeColumnType } from '@/features/orgs/projects/database/dataGrid/utils/normalizeColumnType';
/**
 * Converts a raw database column to a normalized database column.
 *
 * @param rawColumn - Raw database column.
 * @returns Normalized database column.
 */
export default function normalizeDatabaseColumn(
  rawColumn: NormalizedQueryDataRow,
): DatabaseColumn {
  const { normalizedDefaultValue, custom: isDefaultValueCustom } =
    normalizeDefaultValue(rawColumn.column_default);

  return {
    id: rawColumn.column_name,
    name: rawColumn.column_name,
    type: normalizeColumnType(rawColumn),
    isPrimary: rawColumn.is_primary,
    isIdentity: rawColumn.is_identity === 'YES',
    isNullable: rawColumn.is_nullable === 'YES',
    isUnique: rawColumn.is_unique,
    comment: rawColumn.column_comment || null,
    defaultValue: rawColumn.column_default
      ? {
          value: normalizedDefaultValue,
          label: normalizedDefaultValue,
          custom: isDefaultValueCustom,
        }
      : null,
    uniqueConstraints: rawColumn.unique_constraints,
    primaryConstraints: rawColumn.primary_constraints,
    foreignKeyRelation: rawColumn.foreign_key_relation,
  };
}
