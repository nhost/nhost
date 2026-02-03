import type { ColumnDef } from '@tanstack/react-table';
import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import { SortableHeader } from '@/features/orgs/projects/events/common/components/SortableHeader';
import type { CronTriggerInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/cronTriggerInvocationLogEntry';
import InvocationLogActionsCell from './InvocationLogActionsCell';

const columns: ColumnDef<CronTriggerInvocationLogEntry>[] = [
  {
    id: 'created_at',
    accessorKey: 'created_at',
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
    size: 40,
    header: () => <div className="p-2">Status</div>,
    enableSorting: false,
    cell: ({ row }) => <HttpStatusText status={row.original.status} />,
  },
  {
    id: 'id',
    accessorKey: 'id',
    header: () => <div className="p-2">ID</div>,
    size: 170,
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
