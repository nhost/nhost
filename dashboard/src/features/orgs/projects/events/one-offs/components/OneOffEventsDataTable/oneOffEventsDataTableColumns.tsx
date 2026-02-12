import type { ColumnDef } from '@tanstack/react-table';
import { Copy } from 'lucide-react';
import { HoverCardTimestamp } from '@/components/presentational/HoverCardTimestamp';
import { Button } from '@/components/ui/v3/button';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { ScheduledEventStatusCell } from '@/features/orgs/projects/events/common/components/ScheduledEventStatusCell';
import { SortableHeader } from '@/features/orgs/projects/events/common/components/SortableHeader';
import { StatusColumnHeader } from '@/features/orgs/projects/events/common/components/StatusColumnHeader';
import type { EventsSection } from '@/features/orgs/projects/events/common/types';
import copy from '@/utils/copy/copy';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';
import OneOffEventsLogActionsCell from './OneOffEventsLogActionsCell';

interface CreateOneOffEventsDataTableColumnsOptions {
  eventLogsSection: EventsSection;
  onEventLogsSectionChange: (value: EventsSection) => void;
}

export function createOneOffEventsDataTableColumns({
  eventLogsSection,
  onEventLogsSectionChange,
}: CreateOneOffEventsDataTableColumnsOptions) {
  const columns: ColumnDef<ScheduledEventLogEntry>[] = [
    {
      id: 'actions',
      size: 20,
      enableResizing: false,
      enableSorting: false,
      cell: ({ row }) => <OneOffEventsLogActionsCell row={row} />,
    },
    {
      id: 'comment',
      accessorKey: 'comment',
      header: () => <div className="p-2">Comment</div>,
      minSize: 80,
      size: 180,
      maxSize: 400,
      enableResizing: true,
      cell: ({ row }) =>
        row.original.comment ? (
          <TextWithTooltip
            className="text-xs"
            containerClassName="cursor-text"
            text={row.original.comment}
          />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      id: 'scheduled_time',
      accessorKey: 'scheduled_time',
      size: 230,
      enableResizing: true,
      header: ({ column }) => (
        <SortableHeader column={column} label="Scheduled Time" />
      ),
      cell: ({ row }) => (
        <HoverCardTimestamp
          date={new Date(row.original.scheduled_time)}
          className="block w-full truncate font-mono text-xs"
          openDelay={300}
        />
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
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
      id: 'webhook_conf',
      accessorKey: 'webhook_conf',
      header: () => <div className="p-2">Webhook</div>,
      minSize: 80,
      size: 240,
      enableResizing: true,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-1">
          <TextWithTooltip
            className="font-mono text-xs"
            containerClassName="min-w-0 cursor-text"
            text={row.original.webhook_conf}
          />
          <Button
            variant="outline"
            size="icon"
            className="-ml-px h-6 w-6 shrink-0 border-transparent bg-transparent p-1 text-muted-foreground opacity-0 hover:bg-transparent hover:text-foreground group-hover/cell:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              copy(row.original.webhook_conf, 'Webhook');
            }}
            aria-label="Copy webhook"
          >
            <Copy width={16} height={16} />
          </Button>
        </div>
      ),
    },
    {
      id: 'id',
      accessorKey: 'id',
      header: () => <div className="p-2">ID</div>,
      minSize: 40,
      size: 320,
      maxSize: 560,
      enableResizing: true,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-1">
          <TextWithTooltip
            className="font-mono text-xs"
            containerClassName="min-w-0 cursor-text"
            text={row.original.id}
          />
          <Button
            variant="outline"
            size="icon"
            className="-ml-px h-6 w-6 shrink-0 border-transparent bg-transparent p-1 text-muted-foreground opacity-0 hover:bg-transparent hover:text-foreground group-hover/cell:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              copy(row.original.id, 'ID');
            }}
            aria-label="Copy ID"
          >
            <Copy width={16} height={16} />
          </Button>
        </div>
      ),
    },
  ];
  if (eventLogsSection !== 'scheduled') {
    columns.push({
      id: 'tries',
      accessorKey: 'tries',
      size: 70,
      maxSize: 140,
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

export default createOneOffEventsDataTableColumns;
