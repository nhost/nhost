import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isEmptyValue<T>(value: T) {
  return (
    value === undefined ||
    value === 'undefined' ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'NaN' ||
    (typeof value === 'number' && Number.isNaN(value)) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  )
}

export function isNotEmptyValue<T>(value: T): value is Exclude<T, undefined | null> {
  return !isEmptyValue(value)
}
