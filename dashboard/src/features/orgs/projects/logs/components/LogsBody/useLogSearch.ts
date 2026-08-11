import type { SearchRange } from '@/features/orgs/projects/logs/components/LogsBody/highlightLog';
import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

export interface SearchMatch {
  rowIndex: number;
  start: number;
  end: number;
}

export interface UseLogSearchResult {
  searchQuery: string;
  /**
   * The debounced query the `matches` are computed from. Lags `searchQuery` via
   * `useDeferredValue`. Use this (not `searchQuery`) to react to a settled
   * search, so consumers read it in the same render the `matches` updated in.
   */
  searchedQuery: string;
  filterMode: boolean;
  tableData: LogEntry[];
  matches: SearchMatch[];
  rangesByRow: Map<number, SearchRange[]>;
  totalMatches: number;
  currentMatch: number;
  setQuery: (next: string) => void;
  setCurrentMatchIndex: (next: number) => void;
  toggleFilter: () => void;
  clear: () => void;
}

export function useLogSearch(data: LogEntry[]): UseLogSearchResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const deferredQuery = useDeferredValue(searchQuery);

  const tableData = useMemo(() => {
    if (!filterMode || !deferredQuery) return data;
    const lowerQuery = deferredQuery.toLowerCase();
    return data.filter((entry) => entry.log.toLowerCase().includes(lowerQuery));
  }, [data, filterMode, deferredQuery]);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!deferredQuery) return [];
    const lowerQuery = deferredQuery.toLowerCase();
    const results: SearchMatch[] = [];
    for (let r = 0; r < tableData.length; r += 1) {
      const lowerLog = tableData[r].log.toLowerCase();
      let from = 0;
      while (from <= lowerLog.length - lowerQuery.length) {
        const found = lowerLog.indexOf(lowerQuery, from);
        if (found === -1) break;
        results.push({
          rowIndex: r,
          start: found,
          end: found + lowerQuery.length,
        });
        from = found + lowerQuery.length;
      }
    }
    return results;
  }, [tableData, deferredQuery]);

  const totalMatches = matches.length;
  const currentMatch =
    totalMatches === 0 ? 0 : Math.min(currentMatchIndex, totalMatches - 1);

  const rangesByRow = useMemo(() => {
    const map = new Map<number, SearchRange[]>();
    matches.forEach((match, i) => {
      const list = map.get(match.rowIndex) ?? [];
      list.push({
        start: match.start,
        end: match.end,
        isCurrent: i === currentMatch,
      });
      map.set(match.rowIndex, list);
    });
    return map;
  }, [matches, currentMatch]);

  const setQuery = useCallback((next: string) => {
    setSearchQuery(next);
    setCurrentMatchIndex(0);
  }, []);

  const toggleFilter = useCallback(() => {
    setFilterMode((current) => !current);
  }, []);

  const clear = useCallback(() => {
    setSearchQuery('');
    setCurrentMatchIndex(0);
  }, []);

  return {
    searchQuery,
    searchedQuery: deferredQuery,
    filterMode,
    tableData,
    matches,
    rangesByRow,
    totalMatches,
    currentMatch,
    setQuery,
    setCurrentMatchIndex,
    toggleFilter,
    clear,
  };
}
