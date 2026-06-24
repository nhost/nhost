import type { ColumnDefaultValue } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Normalizes a column default returned by PostgreSQL into the verbatim SQL the
 * user would type to reproduce it. PostgreSQL re-applies a `::type` cast to
 * string literals it stores (e.g. `'hello'::text`); we strip only that trailing
 * cast so the value round-trips to what the user entered (`'hello'`). Functions
 * and other expressions are kept as-is, and any expression whose cast is not a
 * simple whole-value cast is left untouched.
 *
 * @example
 * 'Test Value'::text   -> 'Test Value'
 * ''::text             -> ''
 * gen_random_uuid()    -> gen_random_uuid()
 *
 * @param defaultValue - Default value to normalize
 * @returns The verbatim default value, or `null` when there is none.
 */
export default function normalizeDefaultValue(
  defaultValue?: string | null,
): ColumnDefaultValue | null {
  if (!defaultValue) {
    return null;
  }

  // Strip only the final trailing `::type` cast from a whole single-quoted literal (the body may itself contain `::`), keeping the quotes.
  const trailingCastRegExp = /^('(?:[^']|'')*')::(?:\w|\s)+$/;
  const [, literal] = trailingCastRegExp.exec(defaultValue) || [];

  if (literal) {
    return literal;
  }

  return defaultValue;
}
