import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { Button } from '@/components/ui/v3/button';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import { highlightMatch } from '@/features/orgs/utils/highlightMatch';
import { cn } from '@/lib/utils';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronUp } from 'lucide-react';
import InvocationLogActionsCell from './InvocationLogActionsCell';

function CreatedAtHeader({
  column,
}: {
  column: Column<EventInvocationLogEntry, unknown>;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(undefined)}
      className="flex items-center justify-between gap-2"
    >
      <span>Created At</span>
      <span className="flex flex-col">
        <ChevronUp
          className={cn(
            '-mb-0.5 h-4 w-4',
            column.getIsSorted() === 'asc'
              ? 'text-accent-foreground'
              : 'text-muted-foreground',
          )}
        />
        <ChevronDown
          className={cn(
            '-mt-0.5 h-4 w-4',
            column.getIsSorted() === 'desc'
              ? 'text-accent-foreground'
              : 'text-muted-foreground',
          )}
        />
      </span>
    </Button>
  );
}

const columns: ColumnDef<EventInvocationLogEntry>[] = [
  {
    id: 'created_at',
    accessorKey: 'created_at',
    minSize: 50,
    size: 68,
    maxSize: 68,
    header: ({ column }) => <CreatedAtHeader column={column} />,
    cell: ({ row }) => (
      <HoverCardTimestamp
        date={new Date(row.original.created_at)}
        className="-m-4 block w-full truncate py-4 pl-4 font-mono text-xs"
      />
    ),
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
      <TextWithTooltip
        className="font-mono text-xs"
        containerClassName="cursor-text"
        text={highlightMatch(
          row.original.id,
          String(table.getColumn('id')?.getFilterValue() ?? ''),
        )}
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
    cell: ({ row, table }) => (
      <InvocationLogActionsCell row={row.original} table={table} />
    ),
  },
];

export default columns;
