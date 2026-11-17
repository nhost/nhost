import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isEmptyValue<T>(value: T) {
  if (value instanceof Error) {
    return false;
  }

  return (
    value === undefined ||
    value === 'undefined' ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'NaN' ||
    (typeof value === 'number' && Number.isNaN(value)) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

export function isNotEmptyValue<T>(
  value: T,
): value is Exclude<T, undefined | null> {
  return !isEmptyValue(value);
}

export function areStrArraysEqual(arr1: string[], arr2: string[]) {
  if (arr1.length !== arr2.length) {
    return false;
  }

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  return set1.size === set2.size && [...set1].every((col) => set2.has(col));
}

/**
 * Order-sensitive counterpart of `areStrArraysEqual`, for lists that share one
 * authoritative order, such as the paired columns of two foreign keys. Match
 * `foreign_key_constraint_on` columns with `areStrArraysEqual` instead: Hasura
 * resolves them by column set.
 */
export function areStrArraysEqualOrdered(arr1: string[], arr2: string[]) {
  return (
    arr1.length === arr2.length && arr1.every((item, i) => item === arr2[i])
  );
}

export function isJSONString(str: string) {
  try {
    JSON.parse(str);
  } catch {
    return false;
  }
  return true;
}
