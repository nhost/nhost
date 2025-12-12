import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { TimestampColumnHeader } from '@/features/orgs/projects/events/common/components/TimestampColumnHeader';
import { StatusCell } from '@/features/orgs/projects/events/cron-triggers/components/StatusCell';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';
import type { ColumnDef } from '@tanstack/react-table';
import CronTriggerEventsLogActionsCell from './CronTriggerEventsLogActionsCell';
import StatusColumnHeader from './StatusColumnHeader';

export type CronTriggerEventsSection = 'pending' | 'processed' | 'failed';

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
      id: 'created_at',
      accessorKey: 'created_at',
      minSize: 50,
      size: 68,
      maxSize: 68,
      header: ({ column }) => (
        <TimestampColumnHeader column={column} label="Created At" />
      ),
      cell: ({ row }) => (
        <HoverCardTimestamp
          date={new Date(row.original.created_at)}
          className="-m-4 block w-full truncate py-4 pl-4 font-mono text-xs"
        />
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      minSize: 70,
      size: 70,
      maxSize: 70,
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
      id: 'scheduled_time',
      accessorKey: 'scheduled_time',
      minSize: 50,
      size: 68,
      maxSize: 68,
      header: ({ column }) => (
        <TimestampColumnHeader column={column} label="Scheduled Time" />
      ),
      cell: ({ row }) => (
        <HoverCardTimestamp
          date={new Date(row.original.scheduled_time)}
          className="-m-4 block w-full truncate py-4 pl-4 font-mono text-xs"
        />
      ),
    },
    {
      id: 'id',
      accessorKey: 'id',
      header: 'ID',
      minSize: 40,
      size: 280,
      maxSize: 600,
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

  if (eventLogsSection === 'pending') {
    columns.push({
      id: 'actions',
      minSize: 80,
      size: 80,
      maxSize: 80,
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <CronTriggerEventsLogActionsCell status={row.original.status} />
      ),
    });
  }

  return columns;
}

export default createCronTriggerEventsDataTableColumns;
