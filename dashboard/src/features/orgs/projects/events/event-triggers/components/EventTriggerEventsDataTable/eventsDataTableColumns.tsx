import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { CreatedAtHeader } from '@/features/orgs/projects/events/event-triggers/components/CreatedAtHeader';
import { highlightMatch } from '@/features/orgs/utils/highlightMatch';
import type { EventLogEntry } from '@/utils/hasura-api/generated/schemas';
import { type ColumnDef } from '@tanstack/react-table';
import { Check, X } from 'lucide-react';

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
    id: 'delivered',
    accessorKey: 'delivered',
    minSize: 70,
    size: 70,
    maxSize: 70,
    header: () => <div className="text-center">Delivered</div>,
    enableSorting: false,
    cell: ({ row }) => <DeliveredCell delivered={row.original.delivered} />,
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
        slotProps={{
          container: {
            // Prevent row expansion when clicking to select and copy the ID text
            onClick: (event) => event.stopPropagation(),
          },
        }}
      />
    ),
  },
  {
    id: 'tries',
    accessorKey: 'tries',
    minSize: 80,
    size: 80,
    maxSize: 80,
    header: 'Tries',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.tries}</span>
    ),
  },
];

export default columns;
