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
import { EventTriggerInvocationLogsDataTable } from '@/features/orgs/projects/events/components/EventTriggerInvocationLogsDataTable';
import useGetEventLogsQuery from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventLogsQuery/useGetEventLogsQuery';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { cn } from '@/lib/utils';
import type { EventLogEntry } from '@/utils/hasura-api/generated/schemas/eventLogEntry';
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns-v4';
import { ArrowUpDown, Check, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';

function getDeliveredIcon(delivered: boolean) {
  if (delivered) {
    return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  return <X className="h-4 w-4 text-red-600 dark:text-red-400" />;
}

function CreatedAtHeader({
  column,
}: {
  column: Column<EventLogEntry, unknown>;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="px-0"
    >
      Created At
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

function CreatedAtCell({ createdAt }: { createdAt: string }) {
  return (
    <span className="font-mono text-xs">
      {format(new Date(createdAt), 'PPP HH:mm:ss')}
    </span>
  );
}

function DeliveredCell({ delivered }: { delivered: boolean }) {
  return getDeliveredIcon(delivered);
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text: string, query: string) {
  if (!query) {
    return text;
  }

  const safe = escapeRegExp(query);
  const regex = new RegExp(safe, 'gi');
  const nodes: Array<JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      const chunk = text.slice(lastIndex, start);
      nodes.push(<span key={`seg-${lastIndex}`}>{chunk}</span>);
    }

    nodes.push(
      <span key={`hit-${start}`} className="rounded bg-yellow-200/60 px-0.5">
        {match[0]}
      </span>,
    );

    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`seg-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return nodes;
}

function IdCell({ id, query }: { id: string; query: string }) {
  return <span className="font-mono text-xs">{highlightMatch(id, query)}</span>;
}

const columnsBase: ColumnDef<EventLogEntry>[] = [
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: ({ column }) => <CreatedAtHeader column={column} />,
    cell: ({ row }) => <CreatedAtCell createdAt={row.original.created_at} />,
  },
  {
    id: 'delivered',
    accessorKey: 'delivered',
    header: 'Delivered',
    enableSorting: false,
    cell: ({ row }) => <DeliveredCell delivered={row.original.delivered} />,
  },
  {
    id: 'id',
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row, table }) => (
      <IdCell
        id={row.original.id}
        query={String(table.getColumn('id')?.getFilterValue() ?? '')}
      />
    ),
  },
  {
    id: 'tries',
    accessorKey: 'tries',
    header: 'Tries',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.tries}</span>
    ),
  },
  // {
  //   id: 'actions',
  //   header: 'Actions',
  //   enableSorting: false,
  //   cell: ({ row, table }) => <ActionsCell row={row.original} table={table} />,
  // },
];

interface EventTriggerEventsDataTableProps {
  eventTrigger: EventTriggerViewModel;
}

export default function EventTriggerEventsDataTable({
  eventTrigger,
}: EventTriggerEventsDataTableProps) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useGetEventLogsQuery({
    name: eventTrigger.name,
    limit,
    offset,
    source: eventTrigger.dataSource,
  });

  const isLastPage = !!data && data.length < limit;
  const canGoPrev = !isLoading && offset > 0;
  const canGoNext = !isLoading && !isLastPage;

  useEffect(() => {
    if (!isLoading && data && data.length === 0 && offset > 0) {
      setOffset((prev) => Math.max(0, prev - limit));
    }
  }, [data, isLoading, offset, limit]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const columns = useMemo(() => columnsBase, []);

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  return (
    <div
      data-event-trigger-name={eventTrigger.table.name}
      className="rounded border p-4"
    >
      <h3 className="mb-3 font-medium">Events</h3>
      <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Filter by ID..."
          value={(table.getColumn('id')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('id')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                <Fragment key={row.id}>
                  <TableRow
                    onClick={row.getToggleExpandedHandler()}
                    className={cn('cursor-pointer')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
                          source={eventTrigger.dataSource}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
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
