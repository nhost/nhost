import { Button } from '@/components/ui/v3/button';
import type { EventLogEntry } from '@/utils/hasura-api/generated/schemas';
import type { Row } from '@tanstack/react-table';
import { Maximize, Minimize } from 'lucide-react';

interface EventTriggerEventsLogActionsCellProps {
  row: Row<EventLogEntry>;
}

export default function EventTriggerEventsLogActionsCell({
  row,
}: EventTriggerEventsLogActionsCellProps) {
  return (
    <div className="inline-flex w-fit items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={row.getToggleExpandedHandler()}
        className="h-7 w-7 p-0"
        aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
      >
        {row.getIsExpanded() ? (
          <Minimize className="size-4" />
        ) : (
          <Maximize className="size-4" />
        )}
      </Button>
    </div>
  );
}
