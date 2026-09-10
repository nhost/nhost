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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function areStrArraysEqual(arr1: string[], arr2: string[]) {
  if (arr1.length !== arr2.length) {
    return false;
  }

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  return set1.size === set2.size && [...set1].every((col) => set2.has(col));
}

export function isJSONString(str: string) {
  try {
    JSON.parse(str);
  } catch {
    return false;
  }
  return true;
}
