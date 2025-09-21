import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
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
import useGetEventInvocationLogsQuery from '@/features/orgs/projects/events/hooks/useGetEventInvocationLogs/useGetEventInvocationLogsQuery';
import type { EventTriggerUI } from '@/features/orgs/projects/events/types';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import { format } from 'date-fns-v4';
import { Check, Clock, Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EventTriggerInvocationLogsProps {
  eventTrigger: EventTriggerUI;
}

// const mockInvocationLogs = [
//   {
//     id: 'd1de2b04-dbb9-4d21-bdaf-25c3dfef3d7b',
//     trigger_name: 'mytrigger',
//     event_id: 'a7b67072-980d-4cfd-bbfa-a8ee749f453e',
//     http_status: 200,
//     request: {
//       headers: [
//         { name: 'Content-Type', value: 'application/json' },
//         { name: 'User-Agent', value: 'hasura-graphql-engine/v2.46.0-ce' },
//       ],
//       payload: {
//         created_at: '2025-09-19T16:01:30.113893',
//         delivery_info: { current_retry: 0, max_retries: 0 },
//         event: {
//           data: {
//             new: { qweqwe: '123123', sadas: 'qweqwe', sadwq: 'ertert' },
//             old: null,
//           },
//           op: 'INSERT',
//           session_variables: { 'x-hasura-role': 'admin' },
//           trace_context: {
//             sampling_state: '1',
//             span_id: 'febb74c5642c81d7',
//             trace_id: '7f25046b3cbd3c06f379de72bcf3b4ad',
//           },
//         },
//         id: 'a7b67072-980d-4cfd-bbfa-a8ee749f453e',
//         table: { name: 'mytable', schema: 'public' },
//         trigger: { name: 'mytrigger' },
//       },
//       version: '2',
//     },
//     response: {
//       data: {
//         body: '{\n  "args": {}, \n  "data": "{\\"created_at\\":\\"2025-09-19T16:01:30.113893\\",\\"delivery_info\\":{\\"current_retry\\":0,\\"max_retries\\":0},\\"event\\":{\\"data\\":{\\"new\\":{\\"qweqwe\\":\\"123123\\",\\"sadas\\":\\"qweqwe\\",\\"sadwq\\":\\"ertert\\"},\\"old\\":null},\\"op\\":\\"INSERT\\",\\"session_variables\\":{\\"x-hasura-role\\":\\"admin\\"},\\"trace_context\\":{\\"sampling_state\\":\\"1\\",\\"span_id\\":\\"febb74c5642c81d7\\",\\"trace_id\\":\\"7f25046b3cbd3c06f379de72bcf3b4ad\\"}},\\"id\\":\\"a7b67072-980d-4cfd-bbfa-a8ee749f453e\\",\\"table\\":{\\"name\\":\\"mytable\\",\\"schema\\":\\"public\\"},\\"trigger\\":{\\"name\\":\\"mytrigger\\"}}", \n  "files": {}, \n  "form": {}, \n  "headers": {\n    "Accept-Encoding": "gzip", \n    "Content-Length": "479", \n    "Content-Type": "application/json", \n    "Host": "httpbin.org", \n    "User-Agent": "hasura-graphql-engine/v2.46.0-ce", \n    "X-Amzn-Trace-Id": "Root=1-68cd7e5a-6d8d68117343fdbd6f658e7f"\n  }, \n  "json": {\n    "created_at": "2025-09-19T16:01:30.113893", \n    "delivery_info": {\n      "current_retry": 0, \n      "max_retries": 0\n    }, \n    "event": {\n      "data": {\n        "new": {\n          "qweqwe": "123123", \n          "sadas": "qweqwe", \n          "sadwq": "ertert"\n        }, \n        "old": null\n      }, \n      "op": "INSERT", \n      "session_variables": {\n        "x-hasura-role": "admin"\n      }, \n      "trace_context": {\n        "sampling_state": "1", \n        "span_id": "febb74c5642c81d7", \n        "trace_id": "7f25046b3cbd3c06f379de72bcf3b4ad"\n      }\n    }, \n    "id": "a7b67072-980d-4cfd-bbfa-a8ee749f453e", \n    "table": {\n      "name": "mytable", \n      "schema": "public"\n    }, \n    "trigger": {\n      "name": "mytrigger"\n    }\n  }, \n  "origin": "18.198.193.195", \n  "url": "https://httpbin.org/post"\n}\n',
//         headers: [
//           { name: 'Date', value: 'Fri, 19 Sep 2025 16:01:31 GMT' },
//           { name: 'Content-Type', value: 'application/json' },
//           { name: 'Content-Length', value: '1722' },
//           { name: 'Connection', value: 'keep-alive' },
//           { name: 'Server', value: 'gunicorn/19.9.0' },
//           { name: 'Access-Control-Allow-Origin', value: '*' },
//           { name: 'Access-Control-Allow-Credentials', value: 'true' },
//         ],
//         status: 200,
//       },
//       type: 'webhook_response',
//       version: '2',
//     },
//     created_at: '2025-09-19T16:01:31.086239Z',
//   },
// ];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function EventTriggerInvocationLogs({
  eventTrigger,
}: EventTriggerInvocationLogsProps) {
  const [selectedLog, setSelectedLog] =
    useState<EventInvocationLogEntry | null>(null);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useGetEventInvocationLogsQuery({
    name: eventTrigger.name,
    limit,
    offset,
    source: eventTrigger.dataSource,
  });

  // Determine navigation state
  const isLastPage = !!data && data.length < limit;
  const canGoPrev = !isLoading && offset > 0;
  const canGoNext = !isLoading && !isLastPage;

  // Safety: if we land on an empty page, step back until we have data or reach 0
  useEffect(() => {
    if (!isLoading && data && data.length === 0 && offset > 0) {
      setOffset((prev) => Math.max(0, prev - limit));
    }
  }, [data, isLoading, offset, limit]);

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) {
      return <Check className="h-4 w-4 text-green-600" />;
    }
    if (status >= 400) {
      return <X className="h-4 w-4 text-red-600" />;
    }
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div
      data-event-trigger-name={eventTrigger.table.name}
      className="rounded border p-4"
    >
      <h3 className="mb-3 font-medium">Invocation Logs</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created At</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Event ID</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs">
                  {format(new Date(log.created_at), 'PPP HH:mm:ss')}
                </TableCell>
                <TableCell>{getStatusIcon(log.http_status)}</TableCell>
                <TableCell className="font-mono text-xs">{log.id}</TableCell>
                <TableCell className="font-mono text-xs">
                  {log.event_id}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLog(log)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset} - {offset + limit}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoNext}
            onClick={() => canGoNext && setOffset((prev) => prev + limit)}
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            defaultValue="10"
            onValueChange={(value) => {
              setLimit(parseInt(value, 10));
              // Reset offset to avoid landing on empty pages when page size changes
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10" onClick={() => setLimit(10)}>
                10
              </SelectItem>
              <SelectItem value="25" onClick={() => setLimit(25)}>
                25
              </SelectItem>
              <SelectItem value="50" onClick={() => setLimit(50)}>
                50
              </SelectItem>
              <SelectItem value="100" onClick={() => setLimit(100)}>
                100
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Invocation Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
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
                        {selectedLog.request.headers.map((header) => (
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
                    className="py-2"
                    copyToClipboardToastTitle={`${selectedLog.trigger_name} payload`}
                  >
                    {JSON.stringify(selectedLog.request.payload, null, 2)}
                  </CodeBlock>
                  {/* <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                    {JSON.stringify(selectedLog.request.payload, null, 2)}
                  </pre> */}
                </div>
              </TabsContent>
              <TabsContent value="response" className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status: </span>
                    <span
                      className={`font-mono ${selectedLog.http_status >= 200 && selectedLog.http_status < 300 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {selectedLog.response?.data?.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Type: </span>
                    <span className="font-mono">
                      {selectedLog.response?.type}
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
                        {selectedLog.response?.data?.headers?.map((header) => (
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
                <div>
                  <h4 className="mb-2 font-medium">Response Body</h4>
                  <CodeBlock
                    className="w-full max-w-full whitespace-pre-wrap break-all"
                    copyToClipboardToastTitle={`${selectedLog.trigger_name} response body`}
                  >
                    {selectedLog.response?.data?.body}
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
