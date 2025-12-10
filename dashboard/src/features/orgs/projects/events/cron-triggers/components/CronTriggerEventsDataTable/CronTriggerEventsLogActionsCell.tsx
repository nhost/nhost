import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ScheduledEventStatus } from '@/utils/hasura-api/generated/schemas';
import { X } from 'lucide-react';

interface CronTriggerEventsLogActionsCellProps {
  status: ScheduledEventStatus;
}

export default function CronTriggerEventsLogActionsCell({
  status,
}: CronTriggerEventsLogActionsCellProps) {
  const isThisDeleteScheduledEventActionLoading = false;
  const isDeleteScheduledEventDisabled = false;
  const handleDeleteScheduledEvent = () => {
    // TODO: Implement delete scheduled event
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
              disabled={isDeleteScheduledEventDisabled}
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
