import { isNonEmptyString } from '@/lib/utils';

/**
 * Runtime guard for column sets from forms and untyped metadata. A complete
 * set contains at least one unique, non-empty string.
 */
export default function isCompleteColumnSet(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}
