import { useCallback, useMemo } from 'react';
import type { RecentEntry } from '@/features/command-palette/types';
import useSSRLocalStorage from '@/hooks/useSSRLocalStorage/useSSRLocalStorage';

const RECENT_STORAGE_KEY = 'command-palette-recent';
const RECENT_LIMIT = 5;
const NO_RECENT: RecentEntry[] = [];

type RecentDraft = Omit<RecentEntry, 'accessedAt'> & {
  accessedAt?: number;
};

interface UseRecentResult {
  recent: RecentEntry[];
  pushRecent: (entry: RecentDraft) => void;
}

const getDedupeKey = ({
  nodeId,
  orgSlug,
  appSubdomain,
}: Pick<RecentEntry, 'nodeId' | 'orgSlug' | 'appSubdomain'>) =>
  [nodeId, orgSlug ?? '', appSubdomain ?? ''].join(':');

const isRecentEntry = (value: unknown): value is RecentEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.nodeId === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.path === 'string' &&
    typeof entry.accessedAt === 'number' &&
    (entry.orgSlug === undefined || typeof entry.orgSlug === 'string') &&
    (entry.appSubdomain === undefined ||
      typeof entry.appSubdomain === 'string')
  );
};

const parseRecentEntries = (value: unknown): RecentEntry[] =>
  Array.isArray(value) ? value.filter(isRecentEntry) : NO_RECENT;

const readStoredRecent = (fallback: RecentEntry[]): RecentEntry[] => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedRecent = window.localStorage.getItem(RECENT_STORAGE_KEY);

    return storedRecent
      ? parseRecentEntries(JSON.parse(storedRecent))
      : fallback;
  } catch (error) {
    console.error('Error reading command palette recent:', error);
    return fallback;
  }
};

export const useRecent = (): UseRecentResult => {
  const [storedRecent, setRecent] = useSSRLocalStorage<RecentEntry[]>(
    RECENT_STORAGE_KEY,
    NO_RECENT,
  );
  const recent = useMemo(
    () => parseRecentEntries(storedRecent),
    [storedRecent],
  );

  const pushRecent = useCallback(
    (entry: RecentDraft) => {
      const nextEntry: RecentEntry = {
        ...entry,
        accessedAt: entry.accessedAt ?? Date.now(),
      };
      // Re-read storage instead of trusting `recent`: same-tick pushes would
      // otherwise clobber each other through the stale closure state.
      const storedRecent = readStoredRecent(recent);
      const nextKey = getDedupeKey(nextEntry);
      const dedupedRecent = storedRecent.filter(
        (recentEntry) => getDedupeKey(recentEntry) !== nextKey,
      );

      setRecent([nextEntry, ...dedupedRecent].slice(0, RECENT_LIMIT));
    },
    [recent, setRecent],
  );

  return { recent, pushRecent };
};
