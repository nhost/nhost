import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Lock,
  Skull,
  X,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Dialog } from '@/components/ui/v3/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import { ScheduledEventInvocationDialogContent } from '@/features/orgs/projects/events/common/components/ScheduledEventInvocationDialogContent';
import { useDeleteScheduledEventMutation } from '@/features/orgs/projects/events/common/hooks/useDeleteScheduledEventMutation';
import { useGetInvocationLogsById } from '@/features/orgs/projects/events/common/hooks/useGetInvocationLogsById';
import { useCronTriggerEventCounts } from '@/features/orgs/projects/events/cron-triggers/hooks/useCronTriggerEventCounts';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type {
  InvocationLogEntry,
  ScheduledEventLogEntry,
} from '@/utils/hasura-api/generated/schemas';
import type { CronTriggerEventsSection } from './cronTriggerEventsDataTableColumns';

interface CronTriggerEventsDataTableProps {
  triggerName: string;
  eventLogsSection: CronTriggerEventsSection;
  onEventLogsSectionChange: (value: CronTriggerEventsSection) => void;
  data: ScheduledEventLogEntry[] | undefined;
  isLoading: boolean;
  limit: number;
}

const SECTION_LABELS: Record<CronTriggerEventsSection, string> = {
  processed: 'Processed',
  failed: 'Failed',
  scheduled: 'Upcoming',
  all: 'All events',
};

function EventStatus({ status }: { status: string }) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1.5 text-success">
          <CircleCheck className="size-4" />
          Succeeded
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <CircleX className="size-4" />
          Failed
        </span>
      );
    case 'dead':
      return (
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <Skull className="size-4" />
          Dead
        </span>
      );
    case 'locked':
      return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Lock className="size-4" />
          Running
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-4" />
          Upcoming
        </span>
      );
  }
}

function When({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <span className="whitespace-nowrap">
      {format(date, 'd MMM, HH:mm')}
      <span className="ml-2 text-muted-foreground text-xs">
        {formatDistanceToNowStrict(date, { addSuffix: true })}
      </span>
    </span>
  );
}

function CancelEventButton({ eventId }: { eventId: string }) {
  const { mutateAsync, isPending } = useDeleteScheduledEventMutation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ButtonWithLoading
          variant="subtle"
          size="icon-sm"
          aria-label="Cancel event"
          loading={isPending}
          className="hover:text-destructive dark:hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            execPromiseWithErrorToast(
              () => mutateAsync({ type: 'cron', eventId }),
              {
                loadingMessage: 'Cancelling event...',
                successMessage: 'Event cancelled.',
                errorMessage: 'Could not cancel the event.',
              },
            );
          }}
        >
          {!isPending && <X />}
        </ButtonWithLoading>
      </TooltipTrigger>
      <TooltipContent>Cancel event</TooltipContent>
    </Tooltip>
  );
}

function DeliveryAttempts({ eventId }: { eventId: string }) {
  const { data, isLoading } = useGetInvocationLogsById({
    type: 'cron',
    event_id: eventId,
  });
  const [selected, setSelected] = useState<InvocationLogEntry | null>(null);
  const attempts = [...(data ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Event</span>
        <span className="break-all font-mono text-xs">{eventId}</span>
        <CopyToClipboardButton textToCopy={eventId} title="event ID" />
      </div>
      <p className="font-medium text-sm">
        Delivery attempts
        <span className="ml-1.5 font-normal text-muted-foreground">
          {isLoading ? '' : attempts.length}
        </span>
      </p>
      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : attempts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No attempts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border bg-muted/30">
          {attempts.map((attempt, index) => (
            <div
              key={attempt.id}
              className="flex items-center gap-6 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <span className="w-20 text-muted-foreground">
                Attempt {index + 1}
              </span>
              <HttpStatusText
                className="w-10 text-sm"
                status={attempt.status}
              />
              <span className="whitespace-nowrap">
                {format(new Date(attempt.created_at), 'd MMM, HH:mm:ss')}
              </span>
              <button
                type="button"
                className="ml-auto font-medium text-primary text-sm hover:underline"
                onClick={() => setSelected(attempt)}
              >
                Details
              </button>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <ScheduledEventInvocationDialogContent
          log={selected}
          attempt={selected ? attempts.indexOf(selected) + 1 : undefined}
          attempts={attempts.length}
        />
      </Dialog>
    </div>
  );
}

export default function CronTriggerEventsDataTable({
  triggerName,
  eventLogsSection,
  onEventLogsSectionChange,
  data,
  isLoading,
  limit,
}: CronTriggerEventsDataTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const counts = useCronTriggerEventCounts(triggerName);
  const events = [...(data ?? [])].sort(
    (a, b) =>
      new Date(b.scheduled_time).getTime() -
      new Date(a.scheduled_time).getTime(),
  );
  const showTries = eventLogsSection !== 'scheduled';
  const columnCount = 5;

  return (
    <div className="space-y-3 p-6">
      <div className="flex items-center justify-between gap-4">
        <Select
          value={eventLogsSection}
          onValueChange={(value) =>
            onEventLogsSectionChange(value as CronTriggerEventsSection)
          }
        >
          <SelectTrigger className="w-44" aria-label="Show events">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SECTION_LABELS) as CronTriggerEventsSection[]).map(
              (section) => (
                <SelectItem key={section} value={section}>
                  {SECTION_LABELS[section]}
                  {counts.data?.[section] !== undefined && (
                    <span className="ml-1.5 text-muted-foreground text-xs">
                      {counts.data[section]}
                    </span>
                  )}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">Times in your time zone</p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="[&_th]:text-foreground">
            <TableRow>
              <TableHead className="w-8 pr-0" />
              <TableHead>Status</TableHead>
              <TableHead aria-sort="descending">Scheduled</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="text-right">
                {showTries ? 'Tries' : ''}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody aria-busy={isLoading}>
            {isLoading &&
              Array.from({ length: Math.min(limit, 5) }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
                <TableRow key={index}>
                  <TableCell colSpan={columnCount}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading &&
              events.map((event) => {
                const open = expanded === event.id;
                return (
                  <Fragment key={event.id}>
                    <TableRow
                      className="cursor-pointer"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : event.id)}
                    >
                      <TableCell className="w-8 pr-0">
                        <ChevronRight
                          className={cn(
                            'size-4 text-muted-foreground transition-transform',
                            open && 'rotate-90',
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <EventStatus status={event.status} />
                      </TableCell>
                      <TableCell>
                        <When value={event.scheduled_time} />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        {event.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {event.status === 'scheduled' ? (
                          <CancelEventButton eventId={event.id} />
                        ) : (
                          event.tries
                        )}
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell />
                        <TableCell colSpan={columnCount - 1} className="pb-4">
                          <DeliveryAttempts eventId={event.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
          </TableBody>
        </Table>
      </div>
      {!isLoading && data?.length === 0 && (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No {SECTION_LABELS[eventLogsSection].toLowerCase()} events.
        </p>
      )}
    </div>
  );
}
