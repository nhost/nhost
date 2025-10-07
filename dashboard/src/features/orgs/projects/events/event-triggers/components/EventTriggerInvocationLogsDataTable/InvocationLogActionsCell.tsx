import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogTrigger } from '@/components/ui/v3/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { Table as TanStackTable } from '@tanstack/react-table';
import { CalendarSync, Eye } from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';
import InvocationLogDetailsDialogContent from './InvocationLogDetailsDialogContent';

export default function InvocationLogActionsCell({
  row,
  table,
}: {
  row: EventInvocationLogEntry;
  table: TanStackTable<EventInvocationLogEntry>;
}) {
  const meta = table.options.meta as
    | {
        onView?: (row: EventInvocationLogEntry) => void;
        selectedLog?: EventInvocationLogEntry | null;
        setSelectedLog?: Dispatch<
          SetStateAction<EventInvocationLogEntry | null>
        >;
      }
    | undefined;

  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        meta?.setSelectedLog?.(null);
      }, 100);
    }
  };

  const handleRedeliver = () => {};

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedeliver}
            className="-ml-1 h-8 w-8 p-0"
            disabled
          >
            <CalendarSync className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Redeliver Event Invocation</p>
        </TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onView?.(row)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <InvocationLogDetailsDialogContent log={meta?.selectedLog} />
      </Dialog>
    </div>
  );
}
