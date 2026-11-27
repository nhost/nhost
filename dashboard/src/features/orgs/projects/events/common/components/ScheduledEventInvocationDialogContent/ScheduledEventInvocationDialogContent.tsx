import { format } from 'date-fns';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
import { HttpStatusText } from '@/features/orgs/projects/events/common/components/HttpStatusText';
import type { InvocationLogEntry } from '@/utils/hasura-api/generated/schemas';

interface ScheduledEventInvocationDialogContentProps {
  log: InvocationLogEntry | null;
  attempt?: number;
  attempts?: number;
}

function HeaderRows({
  headers,
}: {
  headers?: { name: string; value: string }[] | null;
}) {
  if (!headers?.length) {
    return <p className="text-muted-foreground text-sm">No headers.</p>;
  }
  return (
    <VariableGroup>
      {headers.map((header) => (
        <TableRow key={header.name}>
          <TableCell className="break-words font-mono">{header.name}</TableCell>
          <TableCell className="break-all font-mono text-muted-foreground">
            {header.value}
          </TableCell>
        </TableRow>
      ))}
    </VariableGroup>
  );
}

function IdLine({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
      <CopyToClipboardButton textToCopy={value} title={label} />
    </div>
  );
}

export default function ScheduledEventInvocationDialogContent({
  log,
  attempt,
  attempts,
}: ScheduledEventInvocationDialogContentProps) {
  const responseBody =
    log?.response?.data?.body ?? log?.response?.data?.message;
  return (
    <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-6 overflow-hidden p-12 text-foreground">
      <DialogHeader>
        <DialogTitle className="text-xl">Delivery attempt</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          <HttpStatusText
            className="rounded border px-1.5 py-0.5 text-xs"
            status={log?.status}
          />
          {log?.created_at && (
            <span>{format(new Date(log.created_at), 'd MMM, HH:mm:ss')}</span>
          )}
          {attempt && attempts ? (
            <span>
              · Attempt {attempt} of {attempts}
            </span>
          ) : null}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-2">
        <IdLine label="Invocation ID" value={log?.id} />
        <IdLine label="Event ID" value={log?.event_id} />
      </div>
      {log && (
        <Tabs
          defaultValue="request"
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <TabsList className="self-start">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>
          <TabsContent
            value="request"
            className="mt-4 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1"
          >
            <div>
              <h4 className="mb-2 font-medium text-sm">Payload</h4>
              <CodeBlock
                className="py-2"
                copyToClipboardToastTitle="Request payload"
              >
                {JSON.stringify(log.request.payload, null, 2)}
              </CodeBlock>
            </div>
            <div>
              <h4 className="mb-2 font-medium text-sm">Headers</h4>
              <HeaderRows headers={log.request.headers} />
            </div>
          </TabsContent>
          <TabsContent
            value="response"
            className="mt-4 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1"
          >
            <div>
              <h4 className="mb-2 font-medium text-sm">Body</h4>
              {responseBody ? (
                <CodeBlock
                  className="w-full max-w-full whitespace-pre-wrap break-all py-2"
                  copyToClipboardToastTitle="Response body"
                >
                  {responseBody}
                </CodeBlock>
              ) : (
                <p className="text-muted-foreground text-sm">No body.</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 font-medium text-sm">Headers</h4>
              <HeaderRows headers={log.response?.data?.headers} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </DialogContent>
  );
}
