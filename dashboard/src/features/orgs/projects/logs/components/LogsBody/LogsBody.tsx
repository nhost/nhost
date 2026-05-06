import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { Text } from '@/components/ui/v2/Text';
import { LogsDetailSheet } from '@/features/orgs/projects/logs/components/LogsDetailSheet';
import {
  ACTIONS_WIDTH,
  LOG_CELL_PADDING,
  LOG_CHAR_WIDTH,
  LOG_LEVEL_WIDTH,
  LOG_MIN_WIDTH,
  SERVICE_WIDTH,
  TIMESTAMP_WIDTH,
} from '@/features/orgs/projects/logs/components/LogsBody/columns';
import { LogsBodyCustomMessage } from '@/features/orgs/projects/logs/components/LogsBody/LogsBodyCustomMessage';
import {
  LogsTable,
  type LogsTableHandle,
} from '@/features/orgs/projects/logs/components/LogsBody/LogsTable';
import { isSameLogEntry } from '@/features/orgs/projects/logs/components/LogsBody/isSameLogEntry';
import type {
  LogEntry,
  LogsData,
} from '@/features/orgs/projects/logs/components/LogsBody/types';
import { useGlobalSearchShortcut } from '@/features/orgs/projects/logs/components/LogsBody/useGlobalSearchShortcut';
import { useLogSearch } from '@/features/orgs/projects/logs/components/LogsBody/useLogSearch';
import { LogsSearchBar } from '@/features/orgs/projects/logs/components/LogsSearchBar';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface LogsBodyProps {
  /**
   * The query result
   */
  logsData: LogsData | undefined;
  /**
   * Determines whether or not the query or subscription is loading
   */
  loading: boolean;
  /**
   * Optional error message
   */
  error?: Error;
  tableContainerClasses?: string;
  hideServiceColumn?: boolean;
  /**
   * Active filter set. When any field changes, internal search and selection
   * state (search query, current match, selected log entry, scroll position)
   * is reset. Pass the same object the caller uses to fetch the logs, so the
   * reset key cannot drift out of sync when a new filter is added.
   */
  filters: object;
}

interface LogsBodyContentProps {
  data: LogEntry[];
  totalTableWidth: number;
  hideServiceColumn: boolean;
  tableContainerClasses?: string;
}

function LogsBodyContent({
  data,
  totalTableWidth,
  hideServiceColumn,
  tableContainerClasses,
}: LogsBodyContentProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<LogsTableHandle>(null);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  useGlobalSearchShortcut({ targetRef: searchInputRef });

  const {
    searchQuery,
    searchedQuery,
    filterMode,
    tableData,
    matches,
    rangesByRow,
    totalMatches,
    currentMatch,
    setQuery,
    setCurrentMatchIndex,
    toggleFilter,
    clear: clearSearch,
  } = useLogSearch(data);

  // Scroll to the first match as soon as a search settles, mirroring the
  // browser's Ctrl+F. Keyed on `searchedQuery` (the deferred value the matches
  // are derived from) so it fires once per query change with fresh matches, and
  // never when new logs merely stream in under an unchanged query. An empty
  // query is a no-op, so clearing the search leaves the scroll position alone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `matches` is intentionally excluded — it changes as logs stream in, and re-scrolling then is exactly what we want to avoid; it is always fresh in the render `searchedQuery` changes.
  useEffect(() => {
    if (!searchedQuery || matches.length === 0) {
      return;
    }
    tableRef.current?.scrollToRow(matches[0].rowIndex);
  }, [searchedQuery]);

  const goNext = () => {
    if (totalMatches === 0) return;
    const next = (currentMatch + 1) % totalMatches;
    setCurrentMatchIndex(next);
    tableRef.current?.scrollToRow(matches[next].rowIndex);
  };

  const goPrev = () => {
    if (totalMatches === 0) return;
    const prev = (currentMatch - 1 + totalMatches) % totalMatches;
    setCurrentMatchIndex(prev);
    tableRef.current?.scrollToRow(matches[prev].rowIndex);
  };

  const toggleSelection = (entry: LogEntry) => {
    setSelectedEntry((current) => (isSameLogEntry(current, entry) ? null : entry));
  };

  return (
    <>
      <LogsSearchBar
        ref={searchInputRef}
        query={searchQuery}
        onQueryChange={setQuery}
        totalMatches={totalMatches}
        currentMatch={currentMatch}
        filterMode={filterMode}
        onToggleFilter={toggleFilter}
        onPrev={goPrev}
        onNext={goNext}
        onClear={clearSearch}
      />
      <LogsTable
        ref={tableRef}
        data={tableData}
        rangesByRow={rangesByRow}
        totalTableWidth={totalTableWidth}
        hideServiceColumn={hideServiceColumn}
        selectedEntry={selectedEntry}
        onToggleSelection={toggleSelection}
        className={tableContainerClasses}
      />
      <LogsDetailSheet
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  );
}

export default function LogsBody({
  logsData,
  error,
  loading,
  tableContainerClasses,
  hideServiceColumn,
  filters,
}: LogsBodyProps) {
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  const data = useMemo(
    () =>
      logsData?.logs
        ? [...logsData.logs].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
        : [],
    [logsData],
  );

  const logColumnWidth = useMemo(() => {
    let longest = 0;
    for (const entry of data) {
      const len = entry.log.length;
      if (len > longest) {
        longest = len;
      }
    }
    const measured = longest * LOG_CHAR_WIDTH + LOG_CELL_PADDING;
    return Math.max(LOG_MIN_WIDTH, measured);
  }, [data]);

  const totalTableWidth =
    ACTIONS_WIDTH +
    TIMESTAMP_WIDTH +
    LOG_LEVEL_WIDTH +
    (hideServiceColumn ? 0 : SERVICE_WIDTH) +
    logColumnWidth;

  if (loading && !error) {
    return (
      <TableContainer className="h-full w-full px-4 py-2">
        <ActivityIndicator
          delay={500}
          className="mx-auto"
          label="Loading logs..."
        />
      </TableContainer>
    );
  }

  if (error) {
    return (
      <LogsBodyCustomMessage>
        <Text color="error" className="truncate font-mono text-xs- font-normal">
          {error?.message.includes('the query time range exceeds the limit')
            ? 'The query time range exceeds the limit, please select a shorter range.'
            : error?.message}
        </Text>
      </LogsBodyCustomMessage>
    );
  }

  if (logsData?.logs?.length === 0) {
    return (
      <LogsBodyCustomMessage>
        <Text className="truncate font-mono text-xs- font-normal">
          There are no logs for the selected period.
        </Text>
      </LogsBodyCustomMessage>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-paper">
      <LogsBodyContent
        key={filterKey}
        data={data}
        totalTableWidth={totalTableWidth}
        hideServiceColumn={hideServiceColumn ?? false}
        tableContainerClasses={tableContainerClasses}
      />
    </div>
  );
}
