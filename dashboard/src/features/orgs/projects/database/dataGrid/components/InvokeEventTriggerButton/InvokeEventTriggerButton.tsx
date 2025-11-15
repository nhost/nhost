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
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { InvocationLogDetailsDialogContent } from '@/features/orgs/projects/events/event-triggers/components/InvocationLogDetailsDialogContent';
import { DEFAULT_RETRY_TIMEOUT_SECONDS } from '@/features/orgs/projects/events/event-triggers/constants';
import fetchEventAndInvocationLogsById from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventAndInvocationLogsById/fetchEventAndInvocationLogsById';
import { useGetEventTriggersByTable } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggersByTable';
import { useInvokeEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useInvokeEventTriggerMutation';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';

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
    project?.subdomain!,
    project?.region!,
    'hasura',
  );

  const adminSecret = project?.config?.hasura.adminSecret!;

  const router = useRouter();
  const { dataSourceSlug, schemaSlug, tableSlug } = router.query;

  const { data: eventTriggerNames, isLoading } = useGetEventTriggersByTable({
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

  // const resetState = () => {
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current);
  //     intervalRef.current = null;
  //   }
  // };

  const handleInvokeEventTrigger = async (name: string) => {
    console.log(`Invoking ${name}`);
    try {
      const { event_id } = await invokeEventTrigger({
        args: {
          name,
          source: dataSourceSlug as string,
          payload: selectedValues,
        },
      });
      const data = await fetchEventAndInvocationLogsById({
        appUrl,
        adminSecret,
        args: {
          event_id,
          source: dataSourceSlug as string,
        },
      });
      const invocation = data?.invocations?.[0];
      const previousInvocationId = invocation?.id ?? null;
      setShowDialog(true);

      const start = Date.now();
      const timeoutMs = DEFAULT_RETRY_TIMEOUT_SECONDS * 1000; // TODO: Get from retry_conf.timeout_sec
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
              event_id,
              source: dataSourceSlug as string,
            },
          });
          const firstInvocation = newData?.invocations?.[0];
          if (!firstInvocation) {
            return;
          }
          const { id: firstInvocationId } = firstInvocation;
          if (firstInvocationId !== previousInvocationId) {
            setNewLog(firstInvocation);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        } catch (error) {
          console.error(error);
        }
      }, 1000);
    } catch (error) {
      console.error(error);
    }
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
              eventTriggerNames?.map((name) => (
                <DropdownMenuItem
                  key={name}
                  onSelect={() => handleInvokeEventTrigger(name)}
                >
                  {name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={showDialog} onOpenChange={handleDialogOpenChange}>
        <InvocationLogDetailsDialogContent log={newLog} isLoading={!newLog} />
        {/* <DialogContent className="text-foreground sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Invoke Event Trigger</DialogTitle>
              <DialogDescription>
                <div className="text-sm-">
                  Invoking{' '}
                  <span className="font-mono">{invokedEventTriggerName}</span>{' '}
                  event with ID:
                  <div className="flex items-center justify-between gap-2 break-all rounded bg-muted p-2 font-mono">
                    <span>{eventIdRef.current}adiogfjiadogjaofdigjaifog</span>
                    <CopyToClipboardButton
                      className="bg-[#e3f4fc]/70 dark:bg-[#1e2942]/70 dark:hover:bg-[#253252]"
                      textToCopy={eventIdRef.current}
                      title="Copy event ID"
                    />
                  </div>
                </div>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Fetching invocation info...
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Quit</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent> */}
      </Dialog>
    </>
  );
}
