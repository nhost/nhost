import type { LocationQueryValue } from 'vue-router';

/** A query parameter's first value, as `URLSearchParams.get` reads it. */
export function firstQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first ?? undefined;
}
