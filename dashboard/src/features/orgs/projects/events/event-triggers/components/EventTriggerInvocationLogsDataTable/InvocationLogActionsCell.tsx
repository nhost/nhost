import type { UseQueryResult } from '@tanstack/react-query';
import type { Table as TanStackTable } from '@tanstack/react-table';
import { CalendarSync, Eye } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Dialog, DialogTrigger } from '@/components/ui/v3/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { InvocationLogDetailsDialogContent } from '@/features/orgs/projects/events/event-triggers/components/InvocationLogDetailsDialogContent';
import { DEFAULT_RETRY_TIMEOUT_SECONDS } from '@/features/orgs/projects/events/event-triggers/constants';
import useRedeliverEventMutation from '@/features/orgs/projects/events/event-triggers/hooks/useRedeliverEventMutation/useRedeliverEventMutation';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { GetEventAndInvocationLogsByIdResponse } from '@/utils/hasura-api/generated/schemas';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { EventTriggerInvocationLogsDataTableMeta } from './types';

export default function InvocationLogActionsCell({
  row,
  table,
}: {
  row: EventInvocationLogEntry;
  table: TanStackTable<EventInvocationLogEntry>;
}) {
  const meta = table.options.meta as EventTriggerInvocationLogsDataTableMeta;

  const { mutateAsync: redeliverEvent, isPending: isRedelivering } =
    useRedeliverEventMutation();

  const [open, setOpen] = useState(false);

  const loadingToastIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isThisRedeliverActionLoading, setIsThisRedeliverActionLoading] =
    useState(false);

  const tableRows = table.getCoreRowModel().rows;

  const isRedeliverDisabled = isRedelivering || meta.isRedeliverPending;

  const resetState = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (loadingToastIdRef.current) {
      toast.dismiss(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
    setIsThisRedeliverActionLoading(false);
    meta.setIsRedeliverPending(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        meta.setSelectedLog(null);
      }, 100);
    }
  };

  const handleRedeliver = async () => {
    meta.setIsRedeliverPending(true);
    setIsThisRedeliverActionLoading(true);

    try {
      await redeliverEvent({
        args: {
          event_id: row.event_id,
        },
      });
    } catch {
      toast.error(
        'Failed to redeliver event. Please try again.',
        getToastStyleProps(),
      );
      resetState();
      return;
    }

    loadingToastIdRef.current = toast.loading(
      'Redelivering event',
      getToastStyleProps(),
    );

    const start = Date.now();
    const timeoutMs =
      (meta.retryTimeoutSeconds ?? DEFAULT_RETRY_TIMEOUT_SECONDS) * 1000;

    intervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }
      try {
        const { data, error } =
          (await meta.refetchInvocations()) as UseQueryResult<GetEventAndInvocationLogsByIdResponse>;
        if (error) {
          throw new Error('Failed to fetch invocation logs');
        }

        const originalIds = tableRows.map((tableRow) => tableRow.original.id);
        const newIds = data?.invocations?.map((invocation) => invocation.id);
        const hasNew = newIds?.some((id) => !originalIds.includes(id));
        if (hasNew) {
          resetState();
        }
      } catch (error) {
        toast.error(error?.message, getToastStyleProps());
        resetState();
      }
    }, 1000);
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <ButtonWithLoading
            variant="ghost"
            size="sm"
            onClick={handleRedeliver}
            className="-ml-1 h-8 w-8 p-0"
            disabled={isRedeliverDisabled}
            loading={isThisRedeliverActionLoading}
            loaderClassName="mr-0 size-5"
          >
            {!isThisRedeliverActionLoading && (
              <CalendarSync className="size-4" />
            )}
          </ButtonWithLoading>
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
