/** A search param as Expo Router hands it over: repeated keys give an array. */
export type SearchParam = string | string[] | undefined;

/** The first value of a search param, as `URLSearchParams.get` would read it. */
export function first(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const TIMED_OUT = Symbol('timed out');

/**
 * What `promise` resolves to, or `TIMED_OUT` once `ms` have passed. React
 * Native's `fetch` has no timeout of its own. The promise keeps running.
 */
export function bounded<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
