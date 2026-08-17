import {
  POSTGRESQL_DATE_TYPES,
  POSTGRESQL_INTERVAL_TYPES,
  POSTGRESQL_TIME_TYPES,
  POSTGRESQL_TIMESTAMP_TYPES,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

// These predicates operate on the already-derived `baseType` (the element
// family, with `[]` and `(…)` stripped — see `getBaseType`), not on a raw
// `specificType`. Data-browser `baseType` values are derived from
// PG_CATALOG.FORMAT_TYPE output, so temporal aliases are canonical long SQL
// spellings rather than short `udt_name` aliases. They answer the *family* axis
// only; check `isArray` separately for shape.

/**
 * Whether `baseType` is a PostgreSQL timestamp family.
 */
export function isTimestampType(baseType?: string | null): boolean {
  return POSTGRESQL_TIMESTAMP_TYPES.includes(baseType ?? '');
}

/**
 * Whether `baseType` is a PostgreSQL time-of-day family.
 */
export function isTimeType(baseType?: string | null): boolean {
  return POSTGRESQL_TIME_TYPES.includes(baseType ?? '');
}

/**
 * Whether `baseType` is the PostgreSQL calendar `date`.
 */
export function isDateType(baseType?: string | null): boolean {
  return POSTGRESQL_DATE_TYPES.includes(baseType ?? '');
}

/**
 * Whether `baseType` is a PostgreSQL `interval`, including field-qualified
 * variants such as `interval day to second`.
 */
export function isIntervalType(baseType?: string | null): boolean {
  const base = baseType ?? '';

  return (
    POSTGRESQL_INTERVAL_TYPES.includes(base) || base.startsWith('interval ')
  );
}

/**
 * Whether `baseType` is any PostgreSQL date/time family. Prefer the specific
 * predicates when the distinction matters (input control, validation,
 * serialization) — they are no longer interchangeable as they were under the
 * old coarse `'date'` bucket.
 */
export function isTemporalType(baseType?: string | null): boolean {
  return (
    isTimestampType(baseType) ||
    isTimeType(baseType) ||
    isDateType(baseType) ||
    isIntervalType(baseType)
  );
}
