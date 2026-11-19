/** A search param as Expo Router hands it over: repeated keys give an array. */
export type SearchParam = string | string[] | undefined;

/** The first value of a search param, as `URLSearchParams.get` would read it. */
export function first(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
