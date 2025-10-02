import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useGetEventAndInvocationLogsById } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventAndInvocationLogsById';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import columns from './columns';

interface EventTriggerInvocationLogsDataTableProps {
  eventId: string;
  source: string;
}

export default function EventTriggerInvocationLogsDataTable({
  eventId,
  source,
}: EventTriggerInvocationLogsDataTableProps) {
  const [selectedLog, setSelectedLog] =
    useState<EventInvocationLogEntry | null>(null);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useGetEventAndInvocationLogsById({
    event_id: eventId,
    source,
    invocation_log_limit: limit,
    invocation_log_offset: offset,
  });

  const invocations = data?.invocations;

  const isLastPage = !!invocations && invocations?.length < limit;
  const canGoPrev = !isLoading && offset > 0;
  const canGoNext = !isLoading && !isLastPage;

  useEffect(() => {
    if (!isLoading && invocations && invocations.length === 0 && offset > 0) {
      setOffset((prev) => Math.max(0, prev - limit));
    }
  }, [invocations, isLoading, offset, limit]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: invocations ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      onView: (row: EventInvocationLogEntry) => setSelectedLog(row),
      selectedLog,
      setSelectedLog,
    },
  });

  return (
    <div className="border-t bg-muted p-4 pl-8 dark:bg-muted/40">
      <h3 className="mb-3 font-medium">Related invocations</h3>
      <div className="flex w-full flex-col">
        <Input
          placeholder="Filter invocation log by ID..."
          value={(table.getColumn('id')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('id')?.setFilterValue(event.target.value)
          }
          className="w-full max-w-sm"
        />
      </div>

      <div className="overflow-x-auto">
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
                    className={index === 0 ? 'pl-1' : ''}
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`${cell.column.id === 'id' ? 'max-w-0 truncate' : ''}`}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
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

      <div className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset} - {offset + limit}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoNext}
            onClick={() => canGoNext && setOffset((prev) => prev + limit)}
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            defaultValue="10"
            onValueChange={(value) => {
              setLimit(parseInt(value, 10));
              // Reset offset to avoid landing on empty pages when page size changes
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10" onClick={() => setLimit(10)}>
                10
              </SelectItem>
              <SelectItem value="25" onClick={() => setLimit(25)}>
                25
              </SelectItem>
              <SelectItem value="50" onClick={() => setLimit(50)}>
                50
              </SelectItem>
              <SelectItem value="100" onClick={() => setLimit(100)}>
                100
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
