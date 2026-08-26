import { isNonEmptyString } from '@/lib/utils';

/**
 * A complete column set is a non-empty list of unique, non-empty column
 * names.
 */
export default function isCompleteColumnSet(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}
