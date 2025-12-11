import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import PaginationControls from '@/features/orgs/projects/events/common/components/PaginationControls/PaginationControls';
import { useEventPagination } from '@/features/orgs/projects/events/common/hooks/useEventPagination';
import { CronTriggerInvocationLogsDataTable } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerInvocationLogsDataTable';
import { useGetCronEventLogsQuery } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronEventLogsQuery';
import { cn, isNotEmptyValue } from '@/lib/utils';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Fragment, useMemo, useState } from 'react';
import {
  createCronTriggerEventsDataTableColumns,
  type EventLogsSection,
} from './cronTriggerEventsDataTableColumns';

interface CronTriggerEventsDataTableProps {
  cronTrigger: CronTrigger;
}

export default function CronTriggerEventsDataTable({
  cronTrigger,
}: CronTriggerEventsDataTableProps) {
  const [eventLogsSection, setEventLogsSection] =
    useState<EventLogsSection>('pending');
  const {
    offset,
    limit,
    setLimitAndReset,
    goPrev,
    goNext,
    hasNoPreviousPage,
    hasNoNextPage,
    data,
    isLoading,
  } = useEventPagination({
    useQueryHook: useGetCronEventLogsQuery,
    getQueryArgs: (limitArg, offsetArg) => ({
      trigger_name: cronTrigger.name,
      eventLogsSection,
      limit: limitArg,
      offset: offsetArg,
    }),
    resetKey: `${cronTrigger.name}-${eventLogsSection}`,
  });

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () =>
      createCronTriggerEventsDataTableColumns({
        eventLogsSection,
        onEventLogsSectionChange: setEventLogsSection,
      }),
    [eventLogsSection],
  );

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
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
    <div className="rounded border p-4">
      <h3 className="mb-3 font-medium">Events</h3>

      <Table>
        <colgroup>
          {table.getAllLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={index === 0 ? 'pl-1' : ''}
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading &&
            skeletonRowKeys.map((key) => (
              <TableRow key={`skeleton-${key}`}>
                {table.getAllLeafColumns().map((col) => (
                  <TableCell
                    key={`skeleton-cell-${col.id}`}
                    style={{ width: col.getSize() }}
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
                  onClick={row.getToggleExpandedHandler()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      row.getToggleExpandedHandler()();
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={row.getIsExpanded()}
                  className={cn('cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn({
                        'max-w-0 truncate': cell.column.id === 'id',
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
                      <CronTriggerInvocationLogsDataTable eventId={row.id} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}

          {!isLoading && table.getRowModel().rows?.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <PaginationControls
        offset={offset}
        limit={limit}
        hasNoPreviousPage={hasNoPreviousPage}
        hasNoNextPage={hasNoNextPage}
        onPrev={goPrev}
        onNext={() => !hasNoNextPage && goNext()}
        onChangeLimit={setLimitAndReset}
      />
    </div>
  );
}
