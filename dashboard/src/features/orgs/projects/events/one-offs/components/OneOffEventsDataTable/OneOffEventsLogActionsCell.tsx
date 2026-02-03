import type { Row } from '@tanstack/react-table';
import { Maximize, Minimize, X } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useDeleteScheduledCronTriggerEventMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useDeleteScheduledCronTriggerEventMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';

interface CronTriggerEventsLogActionsCellProps {
  row: Row<ScheduledEventLogEntry>;
}

export default function CronTriggerEventsLogActionsCell({
  row,
}: CronTriggerEventsLogActionsCellProps) {
  const { status, id: scheduledEventId } = row.original;
  const [
    isThisDeleteScheduledEventActionLoading,
    setIsThisDeleteScheduledEventActionLoading,
  ] = useState(false);
  const {
    mutateAsync: deleteScheduledCronTriggerEvent,
    isPending: isDeleteScheduledEventLoading,
  } = useDeleteScheduledCronTriggerEventMutation();

  const handleDeleteScheduledEvent = async () => {
    setIsThisDeleteScheduledEventActionLoading(true);
    await execPromiseWithErrorToast(
      async () => {
        await deleteScheduledCronTriggerEvent({
          eventId: scheduledEventId,
        });
      },
      {
        loadingMessage: 'Deleting scheduled event...',
        successMessage: 'Scheduled event deleted successfully.',
        errorMessage: 'An error occurred while deleting the scheduled event.',
      },
    );
    setIsThisDeleteScheduledEventActionLoading(false);
  };

  return (
    <div className="inline-flex w-fit items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={row.getToggleExpandedHandler()}
        className="h-7 w-7 p-0"
      >
        {row.getIsExpanded() ? (
          <Minimize className="size-4" />
        ) : (
          <Maximize className="size-4" />
        )}
      </Button>
      {status === 'scheduled' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <ButtonWithLoading
              variant="ghost"
              size="sm"
              onClick={handleDeleteScheduledEvent}
              className="h-7 w-7 p-0"
              disabled={isDeleteScheduledEventLoading}
              loading={isThisDeleteScheduledEventActionLoading}
              loaderClassName="mr-0 size-5"
            >
              {!isThisDeleteScheduledEventActionLoading && (
                <X className="size-4" />
              )}
            </ButtonWithLoading>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete Scheduled Event</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
