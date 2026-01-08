import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { SortableHeader } from '@/features/orgs/projects/events/common/components/SortableHeader';
import type { EventLogEntry } from '@/utils/hasura-api/generated/schemas';
import { type ColumnDef } from '@tanstack/react-table';
import { Check, X } from 'lucide-react';
import EventTriggerEventsLogActionsCell from './EventTriggerEventsLogActionsCell';

function DeliveredCell({ delivered }: { delivered: boolean }) {
  if (delivered) {
    return (
      <div className="flex items-center justify-center">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
    </div>
  );
}

const columns: ColumnDef<EventLogEntry>[] = [
  {
    id: 'actions',
    size: 20,
    enableResizing: false,
    enableSorting: false,
    cell: ({ row }) => <EventTriggerEventsLogActionsCell row={row} />,
  },
  {
    id: 'created_at',
    accessorKey: 'created_at',
    size: 190,
    enableResizing: true,
    header: ({ column }) => (
      <SortableHeader column={column} label="Created At" />
    ),
    cell: ({ row }) => (
      <HoverCardTimestamp
        date={new Date(row.original.created_at)}
        className="block w-full truncate font-mono text-xs"
      />
    ),
  },
  {
    id: 'delivered',
    accessorKey: 'delivered',
    minSize: 70,
    size: 70,
    maxSize: 140,
    enableResizing: true,
    header: () => <div className="p-2 text-center">Delivered</div>,
    enableSorting: false,
    cell: ({ row }) => <DeliveredCell delivered={row.original.delivered} />,
  },
  {
    id: 'id',
    accessorKey: 'id',
    header: () => <div className="p-2">ID</div>,
    minSize: 40,
    size: 280,
    maxSize: 560,
    enableResizing: true,
    cell: ({ row }) => (
      <TextWithTooltip
        className="font-mono text-xs"
        containerClassName="cursor-text"
        text={row.original.id}
      />
    ),
  },
  {
    id: 'tries',
    accessorKey: 'tries',
    size: 40,
    maxSize: 80,
    enableResizing: true,
    header: () => <div className="p-2">Tries</div>,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.tries}</span>
    ),
  },
];

export default columns;
