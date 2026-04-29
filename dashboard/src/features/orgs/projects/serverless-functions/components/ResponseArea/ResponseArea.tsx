import { Inbox, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import type { ResponseState } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

export interface ResponseAreaProps {
  response: ResponseState;
}

export default function ResponseArea({ response }: ResponseAreaProps) {
  const [responseTab, setResponseTab] = useState('body');

  if (response.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">Send a request to see the response here</p>
      </div>
    );
  }

  if (response.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Sending request...</p>
      </div>
    );
  }

  const statusColor =
    response.statusCode && response.statusCode < 300
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : response.statusCode && response.statusCode < 500
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

  let formattedBody = response.body ?? '';
  try {
    formattedBody = JSON.stringify(JSON.parse(formattedBody), null, 2);
  } catch {
    // keep raw
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between border-gray-200 border-b px-4 py-2 dark:border-gray-700">
        <Badge className={cn('font-mono text-xs', statusColor)}>
          {response.statusCode} {response.statusText}
        </Badge>
        {response.duration !== undefined && (
          <span className="text-muted-foreground text-xs">
            {response.duration}ms
          </span>
        )}
      </div>

      <Tabs value={responseTab} onValueChange={setResponseTab}>
        <TabsList className="mt-2 ml-4 h-8">
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="mt-0 p-4">
          <pre className="max-h-64 overflow-auto rounded bg-muted p-3 font-mono text-sm">
            {formattedBody}
          </pre>
        </TabsContent>
        <TabsContent value="headers" className="mt-0 p-4">
          <div className="space-y-1">
            {Object.entries(response.headers ?? {}).map(([key, value]) => (
              <div key={key} className="flex gap-2 font-mono text-sm">
                <span className="text-muted-foreground">{key}:</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Only CORS-exposed headers are visible from the browser.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
