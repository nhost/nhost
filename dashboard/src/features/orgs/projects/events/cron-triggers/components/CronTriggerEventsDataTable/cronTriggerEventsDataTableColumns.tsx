import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { ScheduledEventStatusCell } from '@/features/orgs/projects/events/common/components/ScheduledEventStatusCell';
import { SortableHeader } from '@/features/orgs/projects/events/common/components/SortableHeader';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';
import type { ColumnDef } from '@tanstack/react-table';
import CronTriggerEventsLogActionsCell from './CronTriggerEventsLogActionsCell';
import StatusColumnHeader from './StatusColumnHeader';

export type CronTriggerEventsSection =
  | 'scheduled'
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
      size: 20,
      enableResizing: false,
      enableSorting: false,
      cell: ({ row }) => <CronTriggerEventsLogActionsCell row={row} />,
    },
    {
      id: 'scheduled_time',
      accessorKey: 'scheduled_time',
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
      minSize: 70,
      size: 70,
      maxSize: 140,
      enableResizing: true,
      header: () => (
        <StatusColumnHeader
          value={eventLogsSection}
          onChange={onEventLogsSectionChange}
        />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <ScheduledEventStatusCell status={row.original.status} />
      ),
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
  ];
  if (eventLogsSection !== 'scheduled') {
    columns.push({
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
    });
  }

  return columns;
}

export default createCronTriggerEventsDataTableColumns;
