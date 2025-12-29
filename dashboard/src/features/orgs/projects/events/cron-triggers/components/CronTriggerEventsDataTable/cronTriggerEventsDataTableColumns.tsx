import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { SortableHeader } from '@/features/orgs/projects/events/common/components/SortableHeader';
import { StatusCell } from '@/features/orgs/projects/events/cron-triggers/components/StatusCell';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';
import type { ColumnDef } from '@tanstack/react-table';
import CronTriggerEventsLogActionsCell from './CronTriggerEventsLogActionsCell';
import StatusColumnHeader from './StatusColumnHeader';

export type CronTriggerEventsSection =
  | 'pending'
  | 'processed'
  | 'failed'
  | 'all';

interface CreateCronTriggerEventsDataTableColumnsOptions {
  eventLogsSection: CronTriggerEventsSection;
  onEventLogsSectionChange: (value: CronTriggerEventsSection) => void;
}

export function createCronTriggerEventsDataTableColumns({
  eventLogsSection,
  onEventLogsSectionChange,
}: CreateCronTriggerEventsDataTableColumnsOptions) {
  const columns: ColumnDef<ScheduledEventLogEntry>[] = [
    {
      id: 'actions',
      // minSize: 64,
      // size: 64,
      // maxSize: 64,
      size: 0,
      enableResizing: false,
      enableSorting: false,
      cell: ({ row }) => <CronTriggerEventsLogActionsCell row={row} />,
    },
    {
      id: 'scheduled_time',
      accessorKey: 'scheduled_time',
      minSize: 50,
      size: 190,
      enableResizing: true,
      header: ({ column }) => (
        <SortableHeader column={column} label="Scheduled Time" />
      ),
      cell: ({ row }) => (
        <HoverCardTimestamp
          date={new Date(row.original.scheduled_time)}
          className="block w-full truncate font-mono text-xs"
        />
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      size: 40,
      enableResizing: true,
      header: () => (
        <StatusColumnHeader
          value={eventLogsSection}
          onChange={onEventLogsSectionChange}
        />
      ),
      enableSorting: false,
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: 'id',
      accessorKey: 'id',
      header: () => <div className="p-2">ID</div>,
      minSize: 40,
      size: 280,
      maxSize: 600,
      enableResizing: true,
      cell: ({ row }) => (
        <TextWithTooltip
          className="font-mono text-xs"
          containerClassName="cursor-text"
          text={row.original.id}
          slotProps={{
            container: {
              // Prevent row expansion when clicking to select and copy the ID text
              onClick: (event) => event.stopPropagation(),
            },
          }}
        />
      ),
    },
  ];
  if (eventLogsSection !== 'pending') {
    columns.push({
      id: 'tries',
      accessorKey: 'tries',
      size: 80,
      enableResizing: true,
      header: () => <div className="p-2">Tries</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.tries}</span>
      ),
    });
  }

  // columns.push({
  //   id: 'actions',
  //   minSize: 80,
  //   size: 80,
  //   maxSize: 80,
  //   header: 'Actions',
  //   enableSorting: false,
  //   cell: ({ row }) => <CronTriggerEventsLogActionsCell row={row} />,
  // });

  return columns;
}

export default createCronTriggerEventsDataTableColumns;
