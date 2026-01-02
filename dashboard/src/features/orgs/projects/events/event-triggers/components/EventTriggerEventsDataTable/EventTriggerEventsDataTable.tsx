import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { EventTriggerInvocationLogsDataTable } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerInvocationLogsDataTable';
import { DEFAULT_RETRY_TIMEOUT_SECONDS } from '@/features/orgs/projects/events/event-triggers/constants';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { cn, isNotEmptyValue } from '@/lib/utils';
import {
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Fragment, useMemo, useState } from 'react';
import columns from './eventsDataTableColumns';

interface EventTriggerEventsDataTableProps {
  eventTrigger: EventTriggerViewModel;
  data: any[] | undefined;
  isLoading: boolean;
  limit: number;
}

export default function EventTriggerEventsDataTable({
  eventTrigger,
  data,
  isLoading,
  limit,
}: EventTriggerEventsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
      columnSizing,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const skeletonRowKeys = useMemo(
    () => Array.from({ length: limit }, (_, index) => `s${index + 1}`),
    [limit],
  );

  return (
    <div>
      <div className="relative w-full overflow-x-auto">
        <Table className="w-auto table-fixed border-b-1 border-r-1">
          <colgroup>
            {table.getAllLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>

          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header, index) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'group relative overflow-hidden bg-paper font-display text-xs font-bold text-primary-text',
                      'border-b-1 border-r-1 border-t-1 border-divider',
                      '!h-8 p-0',
                      'last:border-r-0',
                      index === 0 ? 'pl-2' : '',
                    )}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}

                    {header.column.getCanResize() && (
                      <button
                        type="button"
                        aria-label={`Resize column ${header.column.id}`}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          header.getResizeHandler()(event);
                        }}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          header.getResizeHandler()(event);
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          header.column.resetSize();
                        }}
                        className={cn(
                          'absolute right-0 top-0 z-20 h-full w-2',
                          'cursor-col-resize touch-none select-none',
                          'border-0 bg-transparent p-0',
                          'group-hover:bg-slate-900 group-hover:bg-opacity-20 group-active:bg-slate-900 group-active:bg-opacity-20 motion-safe:transition-colors',
                          header.column.getIsResizing() &&
                            'bg-slate-900 bg-opacity-20',
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading &&
              skeletonRowKeys.map((key) => (
                <TableRow
                  key={`skeleton-${key}`}
                  className="odd:bg-data-cell-bg-odd even:bg-data-cell-bg hover:!bg-data-cell-bg-hover"
                >
                  {table.getAllLeafColumns().map((col) => (
                    <TableCell
                      key={`skeleton-cell-${col.id}`}
                      style={{ width: col.getSize() }}
                      className="bg-inherit p-2 px-2"
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading &&
              isNotEmptyValue(table.getRowModel().rows) &&
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    aria-expanded={row.getIsExpanded()}
                    className={cn(
                      'odd:bg-data-cell-bg-odd even:bg-data-cell-bg hover:!bg-data-cell-bg-hover',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn('bg-inherit px-2', {
                          'max-w-0 truncate': cell.column.id === 'id',
                          'p-1': cell.column.id === 'actions',
                        })}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow key={`${row.id}-expanded`}>
                      <TableCell colSpan={columns.length} className="p-0">
                        <EventTriggerInvocationLogsDataTable
                          eventId={row.id}
                          retryTimeoutSeconds={
                            eventTrigger.retry_conf?.timeout_sec ??
                            DEFAULT_RETRY_TIMEOUT_SECONDS
                          }
                          source={eventTrigger.dataSource}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}

            {!isLoading && table.getRowModel().rows?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
