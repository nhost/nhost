import { CodeBlock } from '@/components/presentational/CodeBlock';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas';

interface InvocationLogDetailsDialogContentProps {
  log: EventInvocationLogEntry | null;
}

export default function InvocationLogDetailsDialogContent({
  log,
}: InvocationLogDetailsDialogContentProps) {
  return (
    <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-y-auto text-foreground">
      <DialogHeader>
        <DialogTitle className="text-foreground">
          Invocation Log Details
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 rounded border p-4">
        <div className="space-y-2">
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              ID:
            </span>
            <span className="font-mono text-foreground text-sm">{log?.id}</span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              Event ID:
            </span>
            <span className="font-mono text-foreground text-sm">
              {log?.event_id}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              HTTP Status:
            </span>
            <HttpStatusText className="text-sm" status={log?.http_status} />
          </div>
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              Created:
            </span>
            <span className="font-mono text-foreground text-sm">
              {log?.created_at}
            </span>
          </div>
        </div>
      </div>
      {log && (
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
                    {log.request.headers.map((header) => (
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
                copyToClipboardToastTitle={`${log.trigger_name} payload`}
              >
                {JSON.stringify(log.request.payload, null, 2)}
              </CodeBlock>
            </div>
          </TabsContent>
          <TabsContent value="response" className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="font-medium">Status: </span>
                <HttpStatusText
                  className="text-sm"
                  status={log.response?.data?.status}
                />
              </div>
              <div>
                <span className="font-medium">Type: </span>
                <span className="font-mono">{log.response?.type}</span>
              </div>
            </div>
            {log.response?.data?.headers && (
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
                      {log.response?.data?.headers?.map((header) => (
                        <TableRow key={header.name}>
                          <TableCell className="font-mono">
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
            )}
            <div>
              <h4 className="mb-2 font-medium">Response Body</h4>
              <CodeBlock
                className="w-full max-w-full whitespace-pre-wrap break-all rounded py-2"
                copyToClipboardToastTitle={`${log.trigger_name} response body`}
              >
                {log.response?.data?.body ?? log.response?.data?.message}
              </CodeBlock>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </DialogContent>
  );
}
