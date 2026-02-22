import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useGetInvocationLogsById } from '@/features/orgs/projects/events/common/hooks/useGetInvocationLogsById';
import { cn } from '@/lib/utils';
import type { InvocationLogEntry } from '@/utils/hasura-api/generated/schemas/invocationLogEntry';
import columns from './invocationDataTableColumns';
import type { CronTriggerInvocationLogsDataTableMeta } from './types';

interface CronTriggerInvocationLogsDataTableProps {
  eventId: string;
}

const skeletonRowKeys = ['skeleton-s1', 'skeleton-s2', 'skeleton-s3'];

export default function CronTriggerInvocationLogsDataTable({
  eventId,
}: CronTriggerInvocationLogsDataTableProps) {
  const [selectedLog, setSelectedLog] = useState<InvocationLogEntry | null>(
    null,
  );

  const { data, isInitialLoading, isLoading } = useGetInvocationLogsById({
    type: 'cron',
    event_id: eventId,
  });

  const [sorting, setSorting] = useState<SortingState>([]);

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
    meta: {
      selectedLog,
      setSelectedLog,
    } satisfies CronTriggerInvocationLogsDataTableMeta,
  });

  return (
    <div className="border-t bg-muted p-4 pl-8 dark:bg-muted/40">
      <h3 className="mb-3 font-medium">Related invocations</h3>

      <Table>
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
                  className={cn(
                    'group relative overflow-hidden bg-paper font-bold font-display text-primary-text text-xs',
                    'border-divider border-t-1 border-r-1 border-b-1',
                    '!h-8 p-0',
                    'last:border-r-0',
                    index === 0 ? 'pl-2' : '',
                  )}
                  key={header.id}
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
          {isInitialLoading &&
            skeletonRowKeys.map((key) => (
              <TableRow key={key}>
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
            table.getRowModel().rows?.length > 0 &&
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={`${cell.column.id === 'id' ? 'max-w-0 truncate' : ''}`}
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
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
    </div>
  );
}
