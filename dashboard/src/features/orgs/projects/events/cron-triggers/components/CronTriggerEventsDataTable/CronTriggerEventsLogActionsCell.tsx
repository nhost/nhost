import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ScheduledEventLogEntry } from '@/utils/hasura-api/generated/schemas';
import type { Row } from '@tanstack/react-table';
import { Maximize, Minimize, X } from 'lucide-react';

interface CronTriggerEventsLogActionsCellProps {
  row: Row<ScheduledEventLogEntry>;
}

export default function CronTriggerEventsLogActionsCell({
  row,
}: CronTriggerEventsLogActionsCellProps) {
  const { status } = row.original;
  const isThisDeleteScheduledEventActionLoading = false;
  const isDeleteScheduledEventDisabled = false;
  const handleDeleteScheduledEvent = () => {
    // TODO: Implement delete scheduled event
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
      )}
    </div>
  );
}
