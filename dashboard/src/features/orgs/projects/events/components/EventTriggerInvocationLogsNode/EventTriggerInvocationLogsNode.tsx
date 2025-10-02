import { CodeBlock } from '@/components/presentational/CodeBlock';
import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { HttpStatusText } from '@/features/orgs/projects/events/components/HttpStatusText';
import { useGetEventAndInvocationLogsById } from '@/features/orgs/projects/events/hooks/useGetEventAndInvocationLogsById';
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
import { ArrowUpDown, CalendarSync, Eye } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';

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
    <HoverCardTimestamp
      date={new Date(createdAt)}
      className="-m-4 block w-full truncate py-4 pl-4 font-mono text-xs"
    />
  );
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
  return (
    <TextWithTooltip
      className="font-mono text-xs"
      containerClassName="cursor-text"
      text={highlightMatch(id, query)}
    />
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
    | {
        onView?: (row: EventInvocationLogEntry) => void;
        selectedLog?: EventInvocationLogEntry | null;
        setSelectedLog?: Dispatch<
          SetStateAction<EventInvocationLogEntry | null>
        >;
      }
    | undefined;

  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        meta?.setSelectedLog?.(null);
      }, 100);
    }
  };

  const handleRedeliver = () => {};

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedeliver}
            className="-ml-1 h-8 w-8 p-0"
          >
            <CalendarSync className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Redeliver Event Invocation</p>
        </TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onView?.(row)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-y-auto text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Invocation Log Details
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 rounded border p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  ID:
                </span>
                <span className="font-mono text-sm text-foreground">
                  {meta?.selectedLog?.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Event ID:
                </span>
                <span className="font-mono text-sm text-foreground">
                  {meta?.selectedLog?.event_id}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  HTTP Status:
                </span>
                <HttpStatusText
                  className="text-sm"
                  status={meta?.selectedLog?.http_status}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Created:
                </span>
                <span className="font-mono text-sm text-foreground">
                  {meta?.selectedLog?.created_at}
                </span>
              </div>
            </div>
          </div>
          {meta?.selectedLog && (
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
                        {meta.selectedLog.request.headers.map((header) => (
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
                    className="rounded py-2"
                    copyToClipboardToastTitle={`${meta.selectedLog.trigger_name} payload`}
                  >
                    {JSON.stringify(meta.selectedLog.request.payload, null, 2)}
                  </CodeBlock>
                </div>
              </TabsContent>
              <TabsContent value="response" className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status: </span>
                    <HttpStatusText
                      className="text-sm"
                      status={meta.selectedLog.response?.data?.status}
                    />
                  </div>
                  <div>
                    <span className="font-medium">Type: </span>
                    <span className="font-mono">
                      {meta.selectedLog.response?.type}
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
                        {meta.selectedLog.response?.data?.headers?.map(
                          (header) => (
                            <TableRow key={header.name}>
                              <TableCell className="font-mono">
                                {header.name}
                              </TableCell>
                              <TableCell className="font-mono text-muted-foreground">
                                {header.value}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Response Body</h4>
                  <CodeBlock
                    className="w-full max-w-full whitespace-pre-wrap break-all rounded py-2"
                    copyToClipboardToastTitle={`${meta.selectedLog.trigger_name} response body`}
                  >
                    {meta.selectedLog.response?.data?.body ??
                      meta.selectedLog.response?.data?.message}
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

const columnsBase: ColumnDef<EventInvocationLogEntry>[] = [
  {
    id: 'created_at',
    accessorKey: 'created_at',
    minSize: 50,
    size: 68,
    maxSize: 68,
    header: ({ column }) => <CreatedAtHeader column={column} />,
    cell: ({ row }) => <CreatedAtCell createdAt={row.original.created_at} />,
  },
  {
    id: 'http_status',
    accessorKey: 'http_status',
    minSize: 70,
    size: 70,
    maxSize: 70,
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <HttpStatusText status={row.original.http_status} />,
  },
  {
    id: 'id',
    accessorKey: 'id',
    header: 'ID',
    minSize: 40,
    size: 280,
    maxSize: 600,
    cell: ({ row, table }) => (
      <IdCell
        id={row.original.id}
        query={String(table.getColumn('id')?.getFilterValue() ?? '')}
      />
    ),
  },
  {
    id: 'actions',
    minSize: 80,
    size: 80,
    maxSize: 80,
    header: 'Actions',
    enableSorting: false,
    cell: ({ row, table }) => <ActionsCell row={row.original} table={table} />,
  },
];

interface EventTriggerInvocationLogsProps {
  eventId: string;
  source: string;
}

export default function EventTriggerInvocationLogs({
  eventId,
  source,
}: EventTriggerInvocationLogsProps) {
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
  const columns = useMemo(() => columnsBase, []);

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
    <div
      data-event-id={eventId}
      className="border-t bg-muted p-4 pl-8 dark:bg-muted/40"
    >
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
                {headerGroup.headers.map((header) => (
                  <TableHead
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
