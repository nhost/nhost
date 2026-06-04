import type { SearchRange } from '@/features/orgs/projects/logs/components/LogsBody/highlightLog';
import {
  ACTIONS_WIDTH,
  LOG_LEVEL_WIDTH,
  type LogsTableMeta,
  ROW_HEIGHT,
  SERVICE_WIDTH,
  TIMESTAMP_WIDTH,
  logsColumns,
} from '@/features/orgs/projects/logs/components/LogsBody/columns';
import { isSameLogEntry } from '@/features/orgs/projects/logs/components/LogsBody/isSameLogEntry';
import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';
import { cn } from '@/lib/utils';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PanelRightOpen } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

const SCROLL_BUFFER = 32;

export interface LogsTableHandle {
  scrollToRow: (rowIndex: number) => void;
}

export interface LogsTableProps {
  data: LogEntry[];
  rangesByRow: Map<number, SearchRange[]>;
  totalTableWidth: number;
  hideServiceColumn: boolean;
  selectedEntry: LogEntry | null;
  onToggleSelection: (entry: LogEntry) => void;
  className?: string;
}

export const LogsTable = forwardRef<LogsTableHandle, LogsTableProps>(
  function LogsTable(
    {
      data,
      rangesByRow,
      totalTableWidth,
      hideServiceColumn,
      selectedEntry,
      onToggleSelection,
      className,
    },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const visibleColumns = useMemo(
      () =>
        hideServiceColumn
          ? logsColumns.filter((column) => column.id !== 'service')
          : logsColumns,
      [hideServiceColumn],
    );

    const table = useReactTable({
      data,
      columns: visibleColumns,
      defaultColumn: {
        size: 0,
      },
      getCoreRowModel: getCoreRowModel(),
      meta: { rangesByRow } satisfies LogsTableMeta,
    });

    const { rows } = table.getRowModel();

    const rowVirtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 10,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualRows[0]?.start ?? 0;
    const paddingBottom =
      virtualRows.length > 0
        ? totalSize - virtualRows[virtualRows.length - 1].end
        : 0;

    const scrollToRow = useCallback(
      (rowIndex: number) => {
        rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' });

        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        const stickyCover = ACTIONS_WIDTH + TIMESTAMP_WIDTH;

        requestAnimationFrame(() => {
          const segments = scrollEl.querySelectorAll<HTMLElement>(
            '[data-search-current]',
          );
          if (segments.length === 0) return;
          const containerRect = scrollEl.getBoundingClientRect();
          let segLeft = Number.POSITIVE_INFINITY;
          let segRight = Number.NEGATIVE_INFINITY;
          for (const seg of segments) {
            const r = seg.getBoundingClientRect();
            if (r.left < segLeft) segLeft = r.left;
            if (r.right > segRight) segRight = r.right;
          }
          const matchLeft = segLeft - containerRect.left + scrollEl.scrollLeft;
          const matchRight = segRight - containerRect.left + scrollEl.scrollLeft;
          const userVisibleLeft = scrollEl.scrollLeft + stickyCover + SCROLL_BUFFER;
          const userVisibleRight =
            scrollEl.scrollLeft + scrollEl.clientWidth - SCROLL_BUFFER;
          if (matchLeft < userVisibleLeft || matchRight > userVisibleRight) {
            const matchCenter = (matchLeft + matchRight) / 2;
            const visibleAreaWidth = scrollEl.clientWidth - stickyCover;
            const desired = matchCenter - stickyCover - visibleAreaWidth / 2;
            scrollEl.scrollLeft = Math.max(0, desired);
          }
        });
      },
      [rowVirtualizer],
    );

    useImperativeHandle(ref, () => ({ scrollToRow }), [scrollToRow]);

    return (
      <div
        ref={scrollRef}
        className={cn(
          'relative min-h-0 w-full flex-1 overflow-auto bg-paper',
          className,
        )}
        style={{ scrollbarGutter: 'stable' }}
      >
        <table
          className="w-full"
          style={{
            minWidth: totalTableWidth,
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0,
          }}
        >
          <colgroup>
            <col style={{ width: ACTIONS_WIDTH }} />
            <col style={{ width: TIMESTAMP_WIDTH }} />
            <col style={{ width: LOG_LEVEL_WIDTH }} />
            {!hideServiceColumn && <col style={{ width: SERVICE_WIDTH }} />}
            <col />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-[3] border-b border-divider bg-paper p-2"
                  aria-label="Actions"
                />
                {headerGroup.headers.map((header) => {
                  const stickyLeft =
                    header.column.id === 'timestamp' ? ACTIONS_WIDTH : null;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={
                        stickyLeft !== null ? { left: stickyLeft } : undefined
                      }
                      className={cn(
                        'sticky top-0 border-b border-divider bg-paper p-2 text-left align-middle font-display text-xs- font-semibold',
                        stickyLeft !== null ? 'z-[3]' : 'z-[2]',
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden style={{ height: paddingTop }} />
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = isSameLogEntry(selectedEntry, row.original);
              const cellBg = isSelected
                ? 'bg-sky-50 group-hover:bg-sky-100 dark:bg-sky-950 dark:group-hover:bg-sky-900'
                : 'bg-paper group-hover:bg-slate-100 dark:bg-data-cell-bg dark:group-hover:bg-data-cell-bg-hover';
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="group"
                  style={{ height: ROW_HEIGHT }}
                >
                  <td
                    className={cn(
                      'sticky left-0 z-[1] border-b border-divider px-2 align-middle',
                      cellBg,
                    )}
                  >
                    <div className="relative flex items-center justify-center">
                      <button
                        type="button"
                        aria-label="Open log details"
                        onClick={() => onToggleSelection(row.original)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <PanelRightOpen className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const stickyLeft =
                      cell.column.id === 'timestamp' ? ACTIONS_WIDTH : null;
                    return (
                      <td
                        key={cell.id}
                        style={
                          stickyLeft !== null
                            ? { left: stickyLeft }
                            : undefined
                        }
                        className={cn(
                          'overflow-hidden whitespace-nowrap border-b border-divider px-2 align-middle text-[0.75rem] leading-[0.875rem] font-normal tracking-tight',
                          cellBg,
                          stickyLeft !== null && 'sticky z-[1]',
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden style={{ height: paddingBottom }} />
            )}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div
            className="px-4 py-3 text-center font-mono text-xs- text-muted-foreground"
            style={{ minWidth: totalTableWidth }}
          >
            No logs match the current filter.
          </div>
        )}
      </div>
    );
  },
);
