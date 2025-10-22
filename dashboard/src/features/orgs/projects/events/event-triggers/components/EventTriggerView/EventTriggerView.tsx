import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { EventTriggerEventsDataTable } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerEventsDataTable';
import EventTriggerViewSkeleton from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView/EventTriggerViewSkeleton';
import EventTriggerOverview from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView/sections/EventTriggerOverview';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import { isEmptyValue } from '@/lib/utils';
import { useRouter } from 'next/router';

export default function EventTriggerView() {
  const router = useRouter();

  const { eventTriggerSlug } = router.query;

  const { data: eventTriggers, isLoading, error } = useGetEventTriggers();

  const eventTrigger = eventTriggers?.find(
    (trigger) => trigger.name === eventTriggerSlug,
  );

  if (isLoading && eventTriggerSlug) {
    return <EventTriggerViewSkeleton />;
  }

  if (error instanceof Error) {
    return (
      <EventsEmptyState
        title="Event trigger not found"
        description={
          <span>
            Event trigger{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium">
              {eventTriggerSlug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  if (isEmptyValue(eventTrigger)) {
    return (
      <EventsEmptyState
        title="Event trigger not found"
        description={
          <span>
            Event trigger{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium">
              {eventTriggerSlug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return (
    <div className="w-full px-10 py-8">
      <div className="mx-auto w-full max-w-5xl rounded-lg bg-background p-4">
        <div className="mb-6">
          <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
            {eventTrigger!.name}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Event Trigger Configuration
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pending-processed-events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <EventTriggerOverview eventTrigger={eventTrigger!} />
          </TabsContent>
          <TabsContent value="pending-processed-events">
            <EventTriggerEventsDataTable eventTrigger={eventTrigger!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
