import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/components/EventsEmptyState';
import { useGetEventTriggers } from '@/features/orgs/projects/events/hooks/useGetEventTriggers';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { EventTriggerOverview } from '../EventTriggerOverview';

const data = {
  dataSource: 'default',
  table: {
    name: 'users',
    schema: 'public',
  },
  schema: 'public',
  name: 'triggername2',
  definition: {
    enable_manual: true,
    insert: {
      columns: '*',
    },
  },
  retry_conf: {
    interval_sec: 11,
    num_retries: 1,
    timeout_sec: 61,
  },
  webhook: 'https://httpbin.org/post',
  headers: [
    {
      name: 'header',
      value: 'value',
    },
    {
      name: 'header2',
      value: 'NOTENVVAR',
    },
  ],
  request_transform: {
    body: {
      action: 'transform',
      template:
        '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "something": {{$body.event.data.new.role}}\n  }\n}',
    },
    method: 'POST',
    query_params: 'somekriti',
    template_engine: 'Kriti',
    url: '{{$base_url}}/requesturltemplate',
    version: 2,
  },
};

export default function EventTriggerDetails() {
  const router = useRouter();

  const { eventTriggerSlug } = router.query;

  const { data: eventTriggers, status } = useGetEventTriggers();

  const eventTrigger = eventTriggers?.find(
    (trigger) => trigger.name === eventTriggerSlug,
  );

  if (status === 'loading' || !eventTrigger) {
    return (
      <EventsEmptyState
        title="Event trigger not found"
        description={
          <span>
            Event trigger{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
              {eventTriggerSlug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }
  const [isTransformOpen, setIsTransformOpen] = useState(false);

  const operations: string[] = [];
  if (eventTrigger.definition?.insert) {
    operations.push('Insert');
  }
  if (eventTrigger.definition?.update) {
    operations.push('Update');
  }
  if (eventTrigger.definition?.delete) {
    operations.push('Delete');
  }
  if (eventTrigger.definition?.enable_manual) {
    operations.push('Manual (Dashboard)');
  }

  return (
    <div className="p-4">
      <div className="max-w-full rounded-lg bg-white p-4 dark:bg-gray-900">
        <div className="mb-6">
          <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
            {eventTrigger.name}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Event Trigger Configuration
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pending-processed-events">
              Pending/Processed events
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <EventTriggerOverview eventTrigger={eventTrigger} />
          </TabsContent>
          <TabsContent value="pending-processed-events"></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
