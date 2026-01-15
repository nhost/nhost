import { Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/v3/button';
import { Dialog } from '@/components/ui/v3/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { InvocationLogDetailsDialogContent } from '@/features/orgs/projects/events/event-triggers/components/InvocationLogDetailsDialogContent';
import { DEFAULT_RETRY_TIMEOUT_SECONDS } from '@/features/orgs/projects/events/event-triggers/constants';
import fetchEventAndInvocationLogsById from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventAndInvocationLogsById/fetchEventAndInvocationLogsById';
import { useGetEventTriggersByTable } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggersByTable';
import { useInvokeEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useInvokeEventTriggerMutation';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';

export interface InvokeEventTriggerButtonProps {
  selectedValues: Record<string, unknown>;
}

export default function InvokeEventTriggerButton({
  selectedValues,
}: InvokeEventTriggerButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [newLog, setNewLog] = useState<EventInvocationLogEntry | null>(null);
  const { project } = useProject();
  const appUrl = generateAppServiceUrl(
    project!.subdomain!,
    project!.region!,
    'hasura',
  );

  const adminSecret = project!.config!.hasura.adminSecret;

  const router = useRouter();
  const { dataSourceSlug, schemaSlug, tableSlug } = router.query;

  const { data: eventTriggersByTable, isLoading } = useGetEventTriggersByTable({
    table: { name: tableSlug as string, schema: schemaSlug as string },
    dataSource: dataSourceSlug as string,
    queryOptions: {
      enabled:
        typeof tableSlug === 'string' &&
        typeof schemaSlug === 'string' &&
        typeof dataSourceSlug === 'string',
    },
  });

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNewLog(null);
    }
    setShowDialog(newOpen);
  };

  const { mutateAsync: invokeEventTrigger } = useInvokeEventTriggerMutation();

  const resetState = () => {
    setNewLog(null);
    setShowDialog(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleInvokeEventTrigger = async (name: string) => {
    let eventId: string;
    try {
      const response = await invokeEventTrigger({
        args: {
          name,
          source: dataSourceSlug as string,
          payload: selectedValues,
        },
      });
      eventId = response.event_id;
      toast(
        'Event trigger invoked successfully, fetching invocation logs...',
        getToastStyleProps(),
      );
    } catch (error) {
      toast.error(
        error?.message
          ? `Failed to invoke event trigger: ${error.message}`
          : 'Failed to invoke event trigger',
        getToastStyleProps(),
      );
      resetState();
      return;
    }
    setShowDialog(true);

    const eventTrigger = eventTriggersByTable?.find((et) => et.name === name);
    const retryTimeoutSeconds =
      eventTrigger?.retry_conf?.timeout_sec ?? DEFAULT_RETRY_TIMEOUT_SECONDS;

    const start = Date.now();
    const timeoutMs = retryTimeoutSeconds * 1000;
    intervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }
      try {
        const newData = await fetchEventAndInvocationLogsById({
          appUrl,
          adminSecret,
          args: {
            event_id: eventId,
            source: dataSourceSlug as string,
          },
        });
        const firstInvocation = newData?.invocations?.[0];
        if (firstInvocation) {
          setNewLog(firstInvocation);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch {
        toast.error('Failed to fetch invocation logs', getToastStyleProps());
        resetState();
      }
    }, 1000);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Open menu" size="sm">
            Invoke Event Trigger
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40" align="end">
          <DropdownMenuLabel>Invoke</DropdownMenuLabel>
          <DropdownMenuGroup>
            {isLoading ? (
              <DropdownMenuItem disabled>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading...
              </DropdownMenuItem>
            ) : (
              eventTriggersByTable?.map((et) => {
                const eventTriggerName = et.name;
                const disabledManualInvocation = !et.definition.enable_manual;

                return (
                  <DropdownMenuItem
                    key={eventTriggerName}
                    onSelect={(event) => {
                      if (disabledManualInvocation) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      handleInvokeEventTrigger(eventTriggerName);
                    }}
                    aria-disabled={disabledManualInvocation}
                    className={cn(
                      'flex items-center gap-2',
                      disabledManualInvocation &&
                        'hover:!bg-transparent hover:!text-muted-foreground focus:!bg-transparent focus:!text-muted-foreground data-[highlighted]:!bg-transparent data-[highlighted]:!text-muted-foreground cursor-not-allowed text-muted-foreground opacity-50',
                    )}
                  >
                    {eventTriggerName}
                    {disabledManualInvocation ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                          This trigger is not enabled for manual invocation.
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={showDialog} onOpenChange={handleDialogOpenChange}>
        <InvocationLogDetailsDialogContent log={newLog} isLoading={!newLog} />
      </Dialog>
    </>
  );
}
