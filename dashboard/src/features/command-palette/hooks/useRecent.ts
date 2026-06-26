import { useCallback } from 'react';
import type { RecentEntry } from '@/features/command-palette/types';
import useSSRLocalStorage from '@/hooks/useSSRLocalStorage/useSSRLocalStorage';

const RECENT_STORAGE_KEY = 'command-palette-recent';
const RECENT_LIMIT = 5;

type RecentDraft = Omit<RecentEntry, 'accessedAt'> & {
  accessedAt?: number;
};

export interface UseRecentResult {
  recent: RecentEntry[];
  pushRecent: (entry: RecentDraft) => void;
  clearRecent: VoidFunction;
}

const getDedupeKey = ({
  nodeId,
  orgSlug,
  appSubdomain,
}: Pick<RecentEntry, 'nodeId' | 'orgSlug' | 'appSubdomain'>) =>
  [nodeId, orgSlug ?? '', appSubdomain ?? ''].join(':');

const readStoredRecent = (fallback: RecentEntry[]): RecentEntry[] => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedRecent = window.localStorage.getItem(RECENT_STORAGE_KEY);

    return storedRecent ? JSON.parse(storedRecent) : fallback;
  } catch (error) {
    console.error('Error reading command palette recent:', error);
    return fallback;
  }
};

export const useRecent = (): UseRecentResult => {
  const [recent, setRecent] = useSSRLocalStorage<RecentEntry[]>(
    RECENT_STORAGE_KEY,
    [],
  );

  const pushRecent = useCallback(
    (entry: RecentDraft) => {
      const nextEntry: RecentEntry = {
        ...entry,
        accessedAt: entry.accessedAt ?? Date.now(),
      };
      const storedRecent = readStoredRecent(recent);
      const nextKey = getDedupeKey(nextEntry);
      const dedupedRecent = storedRecent.filter(
        (recentEntry) => getDedupeKey(recentEntry) !== nextKey,
      );

      setRecent([nextEntry, ...dedupedRecent].slice(0, RECENT_LIMIT));
    },
    [recent, setRecent],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
  }, [setRecent]);

  return { recent, pushRecent, clearRecent };
};
