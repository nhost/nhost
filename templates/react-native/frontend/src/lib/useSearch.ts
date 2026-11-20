import { useGlobalSearchParams, useSegments } from 'expo-router';
import { useMemo } from 'react';

const DYNAMIC_SEGMENT = /^\[(?:\.\.\.)?(.+)\]$/;

/**
 * The focused screen's query string, `?a=1&b=2` or '', as a web location's
 * `search`. Expo Router hands over decoded params, repeated keys as arrays and
 * dynamic segments mixed in, so the string is built again from them.
 */
export function useSearch(): string {
  const params = useGlobalSearchParams();
  const segments = useSegments();

  return useMemo(() => {
    const dynamic = new Set(
      segments.flatMap((segment) => DYNAMIC_SEGMENT.exec(segment)?.[1] ?? []),
    );
    // Only for serialising: React Native's URL parsing is not the standard's.
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (dynamic.has(name)) {
        continue;
      }
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined) {
          search.append(name, item);
        }
      }
    }
    const query = search.toString();
    return query === '' ? '' : `?${query}`;
  }, [params, segments]);
}
