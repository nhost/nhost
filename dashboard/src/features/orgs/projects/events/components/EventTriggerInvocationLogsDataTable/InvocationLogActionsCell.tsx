import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { Table as TanStackTable } from '@tanstack/react-table';
import { CalendarSync, Eye } from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';

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
        <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-y-auto text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Invocation Log Details
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 rounded border p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  ID:
                </span>
                <span className="font-mono text-sm text-foreground">
                  {meta?.selectedLog?.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Event ID:
                </span>
                <span className="font-mono text-sm text-foreground">
                  {meta?.selectedLog?.event_id}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  HTTP Status:
                </span>
                <HttpStatusText
                  className="text-sm"
                  status={meta?.selectedLog?.http_status}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Created:
                </span>
                <span className="font-mono text-sm text-foreground">
                  {meta?.selectedLog?.created_at}
                </span>
              </div>
            </div>
          </div>
          {meta?.selectedLog && (
            <Tabs defaultValue="request" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium text-foreground">Headers</h4>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meta.selectedLog.request.headers.map((header) => (
                          <TableRow key={header.name}>
                            <TableCell className="font-mono text-foreground">
                              {header.name}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {header.value}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium text-foreground">Payload</h4>
                  <CodeBlock
                    className="rounded py-2"
                    copyToClipboardToastTitle={`${meta.selectedLog.trigger_name} payload`}
                  >
                    {JSON.stringify(meta.selectedLog.request.payload, null, 2)}
                  </CodeBlock>
                </div>
              </TabsContent>
              <TabsContent value="response" className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status: </span>
                    <HttpStatusText
                      className="text-sm"
                      status={meta.selectedLog.response?.data?.status}
                    />
                  </div>
                  <div>
                    <span className="font-medium">Type: </span>
                    <span className="font-mono">
                      {meta.selectedLog.response?.type}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Headers</h4>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meta.selectedLog.response?.data?.headers?.map(
                          (header) => (
                            <TableRow key={header.name}>
                              <TableCell className="font-mono">
                                {header.name}
                              </TableCell>
                              <TableCell className="font-mono text-muted-foreground">
                                {header.value}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Response Body</h4>
                  <CodeBlock
                    className="w-full max-w-full whitespace-pre-wrap break-all rounded py-2"
                    copyToClipboardToastTitle={`${meta.selectedLog.trigger_name} response body`}
                  >
                    {meta.selectedLog.response?.data?.body ??
                      meta.selectedLog.response?.data?.message}
                  </CodeBlock>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
