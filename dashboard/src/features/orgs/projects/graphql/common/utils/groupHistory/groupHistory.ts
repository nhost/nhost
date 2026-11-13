import type { QueryStoreItem } from '@graphiql/toolkit';

/** One row in the History panel: the newest run and every copy of it. */
export interface HistoryEntry {
  item: QueryStoreItem;
  copies: QueryStoreItem[];
}

// Two runs are the same entry when the query and variables match. Whitespace
// around them doesn't count, headers never do (they aren't kept).
export function getHistoryKey(
  item: Pick<QueryStoreItem, 'query' | 'variables'>,
) {
  return `${(item.query ?? '').trim()}\u0000${(item.variables ?? '').trim()}`;
}

function groupByKey(items: QueryStoreItem[]) {
  const entries = new Map<string, HistoryEntry>();

  for (const item of items) {
    const key = getHistoryKey(item);
    const entry = entries.get(key);

    if (entry) {
      entry.copies.push(item);
    } else {
      entries.set(key, { item, copies: [item] });
    }
  }

  return entries;
}

/**
 * Splits GraphiQL's history (oldest first) into starred and recent rows,
 * newest first. Running the same query again doesn't add a row, and a
 * starred query isn't repeated under recent.
 */
export function groupHistory(items: readonly QueryStoreItem[]) {
  const newestFirst = [...items].reverse();
  const starred = groupByKey(newestFirst.filter((item) => item.favorite));
  const recent = groupByKey(newestFirst.filter((item) => !item.favorite));

  for (const key of starred.keys()) {
    recent.delete(key);
  }

  return {
    starred: [...starred.values()],
    recent: [...recent.values()],
  };
}

/**
 * Keeps one copy of each query in a saved history list (oldest first), the
 * newest one, in the newest position.
 */
export function withoutDuplicateRuns<T extends QueryStoreItem>(items: T[]) {
  const seen = new Set<string>();
  const kept: T[] = [];

  for (const item of [...items].reverse()) {
    const key = getHistoryKey(item);

    if (!seen.has(key)) {
      seen.add(key);
      kept.unshift(item);
    }
  }

  return kept;
}
