import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import { SortableHeader } from '@/features/orgs/projects/events/common/components/SortableHeader';
import type { CronTriggerInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/cronTriggerInvocationLogEntry';
import type { ColumnDef } from '@tanstack/react-table';
import InvocationLogActionsCell from './InvocationLogActionsCell';

const columns: ColumnDef<CronTriggerInvocationLogEntry>[] = [
  {
    id: 'created_at',
    accessorKey: 'created_at',
    minSize: 50,
    size: 68,
    maxSize: 68,
    header: ({ column }) => (
      <SortableHeader column={column} label="Created At" />
    ),
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
    header: () => <div className="p-2">Status</div>,
    enableSorting: false,
    cell: ({ row }) => <HttpStatusText status={row.original.status} />,
  },
  {
    id: 'id',
    accessorKey: 'id',
    header: () => <div className="p-2">ID</div>,
    minSize: 40,
    size: 280,
    maxSize: 600,
    cell: ({ row }) => (
      <TextWithTooltip
        className="font-mono text-xs"
        containerClassName="cursor-text"
        text={row.original.id}
      />
    ),
  },
  {
    id: 'actions',
    minSize: 80,
    size: 80,
    maxSize: 80,
    header: () => <div className="p-2">Actions</div>,
    enableSorting: false,
    cell: ({ row, table }) => (
      <InvocationLogActionsCell row={row.original} table={table} />
    ),
  },
];

export default columns;
