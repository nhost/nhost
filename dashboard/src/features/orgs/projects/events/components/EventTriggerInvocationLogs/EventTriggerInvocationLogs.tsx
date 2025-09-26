import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import useGetEventInvocationLogsQuery from '@/features/orgs/projects/events/hooks/useGetEventInvocationLogsQuery/useGetEventInvocationLogsQuery';
import type { EventTriggerUI } from '@/features/orgs/projects/events/types';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  type Table as TanStackTable,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns-v4';
import { ArrowUpDown, Check, Clock, Eye, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// Helpers and column cell/header components (module scope to satisfy lint rules)
function getStatusIcon(status: number) {
  if (status >= 200 && status < 300) {
    return <Check className="h-4 w-4 text-green-600" />;
  }
  if (status >= 400) {
    return <X className="h-4 w-4 text-red-600" />;
  }
  return <Clock className="h-4 w-4 text-yellow-600" />;
}

function CreatedAtHeader({
  column,
}: {
  column: Column<EventInvocationLogEntry, unknown>;
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

function HttpStatusCell({ status }: { status: number }) {
  return getStatusIcon(status);
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

function EventIdCell({ eventId, query }: { eventId: string; query: string }) {
  return (
    <span className="font-mono text-xs">{highlightMatch(eventId, query)}</span>
  );
}

function ActionsCell({
  row,
  table,
}: {
  row: EventInvocationLogEntry;
  table: TanStackTable<EventInvocationLogEntry>;
}) {
  const meta = table.options.meta as
    | { onView?: (row: EventInvocationLogEntry) => void }
    | undefined;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => meta?.onView?.(row)}
      className="h-8 w-8 p-0"
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}

const columnsBase: ColumnDef<EventInvocationLogEntry>[] = [
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: ({ column }) => <CreatedAtHeader column={column} />,
    cell: ({ row }) => <CreatedAtCell createdAt={row.original.created_at} />,
  },
  {
    id: 'http_status',
    accessorKey: 'http_status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <HttpStatusCell status={row.original.http_status} />,
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
    id: 'event_id',
    accessorKey: 'event_id',
    header: 'Event ID',
    cell: ({ row, table }) => (
      <EventIdCell
        eventId={row.original.event_id}
        query={String(table.getColumn('event_id')?.getFilterValue() ?? '')}
      />
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row, table }) => <ActionsCell row={row.original} table={table} />,
  },
];

interface EventTriggerInvocationLogsProps {
  eventTrigger: EventTriggerUI;
}

export default function EventTriggerInvocationLogs({
  eventTrigger,
}: EventTriggerInvocationLogsProps) {
  const [selectedLog, setSelectedLog] =
    useState<EventInvocationLogEntry | null>(null);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useGetEventInvocationLogsQuery({
    name: eventTrigger.name,
    limit,
    offset,
    source: eventTrigger.dataSource,
  });

  // Determine navigation state
  const isLastPage = !!data && data.length < limit;
  const canGoPrev = !isLoading && offset > 0;
  const canGoNext = !isLoading && !isLastPage;

  // Safety: if we land on an empty page, step back until we have data or reach 0
  useEffect(() => {
    if (!isLoading && data && data.length === 0 && offset > 0) {
      setOffset((prev) => Math.max(0, prev - limit));
    }
  }, [data, isLoading, offset, limit]);

  // TanStack Table setup for sorting and filtering (client-side)
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
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      onView: (row: EventInvocationLogEntry) => setSelectedLog(row),
    },
  });

  return (
    <div
      data-event-trigger-name={eventTrigger.table.name}
      className="rounded border p-4"
    >
      <h3 className="mb-3 font-medium">Invocation Logs</h3>
      <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Filter by ID..."
          value={(table.getColumn('id')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('id')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <Input
          placeholder="Filter by Event ID..."
          value={
            (table.getColumn('event_id')?.getFilterValue() as string) ?? ''
          }
          onChange={(event) =>
            table.getColumn('event_id')?.setFilterValue(event.target.value)
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Invocation Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <Tabs defaultValue="request" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium text-foreground">Headers</h4>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedLog.request.headers.map((header) => (
                          <TableRow key={header.name}>
                            <TableCell className="font-mono text-foreground">
                              {header.name}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {header.value}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium text-foreground">Payload</h4>
                  <CodeBlock
                    className="py-2"
                    copyToClipboardToastTitle={`${selectedLog.trigger_name} payload`}
                  >
                    {JSON.stringify(selectedLog.request.payload, null, 2)}
                  </CodeBlock>
                  {/* <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                    {JSON.stringify(selectedLog.request.payload, null, 2)}
                  </pre> */}
                </div>
              </TabsContent>
              <TabsContent value="response" className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status: </span>
                    <span
                      className={`font-mono ${selectedLog.http_status >= 200 && selectedLog.http_status < 300 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {selectedLog.response?.data?.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Type: </span>
                    <span className="font-mono">
                      {selectedLog.response?.type}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Headers</h4>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedLog.response?.data?.headers?.map((header) => (
                          <TableRow key={header.name}>
                            <TableCell className="font-mono">
                              {header.name}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {header.value}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Response Body</h4>
                  <CodeBlock
                    className="w-full max-w-full whitespace-pre-wrap break-all"
                    copyToClipboardToastTitle={`${selectedLog.trigger_name} response body`}
                  >
                    {selectedLog.response?.data?.body}
                  </CodeBlock>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
