import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogTrigger } from '@/components/ui/v3/dialog';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DEFAULT_RETRY_TIMEOUT_SECONDS } from '@/features/orgs/projects/events/event-triggers/constants';
import useRedeliverEventMutation from '@/features/orgs/projects/events/event-triggers/hooks/useRedeliverEventMutation/useRedeliverEventMutation';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { Table as TanStackTable } from '@tanstack/react-table';
import { CalendarSync, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import InvocationLogDetailsDialogContent from './InvocationLogDetailsDialogContent';
import type { EventTriggerInvocationLogsDataTableMeta } from './types';

export default function InvocationLogActionsCell({
  row,
  table,
}: {
  row: EventInvocationLogEntry;
  table: TanStackTable<EventInvocationLogEntry>;
}) {
  const meta = table.options.meta as EventTriggerInvocationLogsDataTableMeta;

  const { mutateAsync: redeliverEvent, isLoading: isRedelivering } =
    useRedeliverEventMutation();

  const [open, setOpen] = useState(false);

  const prevIdsRef = useRef<string[]>([]);
  const [skeletonId, setSkeletonId] = useState<string | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const tableRows = table.getCoreRowModel().rows;

  useEffect(() => {
    const currentIds = tableRows.map((i) => i.original.id);
    const prevIds = prevIdsRef.current;
    const hasNew = currentIds.some((id) => !prevIds.includes(id));
    if (hasNew) {
      if (skeletonId) {
        meta.removePendingSkeleton?.(skeletonId);
        setSkeletonId(null);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    }
    prevIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skeletonId, tableRows]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        meta.setSelectedLog(null);
      }, 100);
    }
  };

  const handleRedeliver = async () => {
    if (!meta.addPendingSkeleton) {
      toast.error('Failed to redeliver event', getToastStyleProps());
      return;
    }
    setSkeletonId(meta.addPendingSkeleton());

    try {
      await redeliverEvent({
        args: {
          event_id: row.event_id,
        },
      });
    } catch (error) {
      toast.error('Failed to redeliver event', getToastStyleProps());
    }

    loadingToastIdRef.current = toast.loading(
      'Redelivering event',
      getToastStyleProps(),
    );

    const start = Date.now();
    const timeoutMs =
      (meta.retryTimeoutSeconds ?? DEFAULT_RETRY_TIMEOUT_SECONDS) * 1000;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }
      try {
        meta.refetchInvocations?.();
      } catch (error) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = null;
        loadingToastIdRef.current = null;
      }
    }, 5000);
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedeliver}
            className="-ml-1 h-8 w-8 p-0"
            disabled={isRedelivering || !!skeletonId}
          >
            {isRedelivering || skeletonId ? (
              <Spinner size="small" />
            ) : (
              <CalendarSync className="h-4 w-4" />
            )}
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
            onClick={() => meta.setSelectedLog(row)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <InvocationLogDetailsDialogContent log={meta.selectedLog} />
      </Dialog>
    </div>
  );
}
