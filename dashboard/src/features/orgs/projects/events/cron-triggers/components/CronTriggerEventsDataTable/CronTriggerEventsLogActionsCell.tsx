import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useDeleteScheduledCronTriggerEventMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useDeleteScheduledCronTriggerEventMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ScheduledEventStatus } from '@/utils/hasura-api/generated/schemas';
import { X } from 'lucide-react';
import { useState } from 'react';

interface CronTriggerEventsLogActionsCellProps {
  scheduledEventId: string;
  status: ScheduledEventStatus;
}

export default function CronTriggerEventsLogActionsCell({
  scheduledEventId,
  status,
}: CronTriggerEventsLogActionsCellProps) {
  const [
    isThisDeleteScheduledEventActionLoading,
    setIsThisDeleteScheduledEventActionLoading,
  ] = useState(false);
  const {
    mutateAsync: deleteScheduledCronTriggerEvent,
    isLoading: isDeleteScheduledEventLoading,
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

  if (status === 'scheduled') {
    return (
      <div className="flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <ButtonWithLoading
              variant="ghost"
              size="sm"
              onClick={handleDeleteScheduledEvent}
              className="h-8 w-8 p-0"
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
      </div>
    );
  }

  return null;
}
