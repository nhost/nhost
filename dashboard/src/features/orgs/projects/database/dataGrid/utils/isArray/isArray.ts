const ARRAY_SUFFIX_REGEX = /(\[\])+$/;

/**
 * Whether a PostgreSQL `specificType` denotes an array (`integer[]`,
 * `text[][]`, …). This is the *shape* axis of a column type; pair it with
 * `getBaseType` (the *family* axis) to describe a column without losing
 * information — `getBaseType` strips the `[]`, this keeps it.
 *
 * @example
 * isArray('integer[]')  // true
 * isArray('integer')    // false
 */
export default function isArray(specificType?: string | null): boolean {
  return ARRAY_SUFFIX_REGEX.test(specificType ?? '');
}
