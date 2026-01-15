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
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { CronTriggerInvocationLogsDataTable } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerInvocationLogsDataTable';
import { cn, isNotEmptyValue } from '@/lib/utils';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';
import {
  type CronTriggerEventsSection,
  createCronTriggerEventsDataTableColumns,
} from './cronTriggerEventsDataTableColumns';

interface CronTriggerEventsDataTableProps {
  eventLogsSection: CronTriggerEventsSection;
  onEventLogsSectionChange: (value: CronTriggerEventsSection) => void;
  data: ScheduledEventLogEntry[] | undefined;
  isLoading: boolean;
  limit: number;
}

export default function CronTriggerEventsDataTable({
  eventLogsSection,
  onEventLogsSectionChange,
  data,
  isLoading,
  limit,
}: CronTriggerEventsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const columns = useMemo(
    () =>
      createCronTriggerEventsDataTableColumns({
        eventLogsSection,
        onEventLogsSectionChange,
      }),
    [eventLogsSection, onEventLogsSectionChange],
  );

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
    <Table
      containerClassName="overflow-visible"
      className="w-auto caption-bottom border-separate border-spacing-0 border-r-1 border-b-1 text-sm"
    >
      <TableHeader className="sticky top-0 z-30">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className="!border-0 hover:bg-transparent"
          >
            {headerGroup.headers.map((header, index) => {
              const isLast = index === headerGroup.headers.length - 1;
              return (
                <TableHead
                  key={header.id}
                  className={cn(
                    'group relative bg-paper font-bold font-display text-primary-text text-xs',
                    '!h-8 p-0',
                    index === 0 ? 'pl-2' : '',
                    'border-b-1',
                    !isLast && 'border-r-1',
                  )}
                  style={{
                    width: header.getSize(),
                  }}
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
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => header.column.resetSize()}
                      className={cn(
                        'absolute top-0 right-0 z-20 h-full w-2',
                        'cursor-col-resize touch-none select-none',
                        'border-0 bg-transparent p-0',
                        'group-hover:bg-slate-900 group-hover:bg-opacity-20 group-active:bg-slate-900 group-active:bg-opacity-20 motion-safe:transition-colors',
                        header.column.getIsResizing() &&
                          'bg-slate-900 bg-opacity-20',
                      )}
                    />
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading &&
          skeletonRowKeys.map((key) => (
            <TableRow
              key={`skeleton-${key}`}
              className="hover:!bg-data-cell-bg-hover border-0 odd:bg-data-cell-bg-odd even:bg-data-cell-bg"
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
                  'border-0',
                  'hover:!bg-data-cell-bg-hover odd:bg-data-cell-bg-odd even:bg-data-cell-bg',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn('bg-inherit px-2', {
                      'max-w-0 truncate':
                        cell.column.id === 'id' ||
                        cell.column.id === 'scheduled_time',
                      'p-1': cell.column.id === 'actions',
                    })}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {row.getIsExpanded() && (
                <TableRow key={`${row.id}-expanded`} className="border-0">
                  <TableCell colSpan={columns.length} className="p-0">
                    <CronTriggerInvocationLogsDataTable eventId={row.id} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}

        {!isLoading && table.getRowModel().rows?.length === 0 && (
          <TableRow className="border-0">
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
