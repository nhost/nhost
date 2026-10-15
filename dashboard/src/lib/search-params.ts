export type SearchParamValue = string | string[];

/**
 * Parses the URL search string into plain strings, the way the browser and
 * the systems linking to the dashboard (Stripe, GitHub, OAuth2 clients, auth
 * emails) write them. A key that appears more than once becomes an array.
 * TanStack Router's default parser would JSON-decode values instead
 * (`?page=2` → number), so routes narrow and coerce with `validateSearch`.
 */
export function parseSearch(
  searchStr: string,
): Record<string, SearchParamValue> {
  const params = new URLSearchParams(searchStr);
  const search: Record<string, SearchParamValue> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    search[key] = values.length === 1 ? values[0] : values;
  }

  return search;
}

/**
 * Inverse of `parseSearch`. Numbers and booleans are written with `String()`;
 * `undefined` and `null` drop the key.
 */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (item === undefined || item === null) {
        continue;
      }

      params.append(key, String(item));
    }
  }

  const searchStr = params.toString();

  return searchStr ? `?${searchStr}` : '';
}

/**
 * Returns the first value of a search param, the way most of the dashboard
 * reads them.
 */
export function getSearchParam(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}
