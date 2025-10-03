import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { EventTriggerEventsDataTable } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerEventsDataTable';
import { EventTriggerOverview } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerOverview';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import { useRouter } from 'next/router';

export default function EventTriggerDetails() {
  const router = useRouter();

  const { eventTriggerSlug } = router.query;

  const { data: eventTriggers, isLoading } = useGetEventTriggers();

  const eventTrigger = eventTriggers?.find(
    (trigger) => trigger.name === eventTriggerSlug,
  );

  if (isLoading && eventTriggerSlug) {
    return (
      <div className="w-full px-10 py-8">
        <div className="mx-auto w-full max-w-5xl rounded-lg bg-background p-4">
          <div className="mb-6">
            <Skeleton className="mb-1 h-7 w-52" />
            <Skeleton className="h-4 w-40" />
          </div>

          <div className="mb-4 flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
                <Skeleton className="mb-3 h-5 w-40" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
              <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
                <Skeleton className="mb-3 h-5 w-44" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>

            <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
              <Skeleton className="mb-3 h-5 w-48" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>

            <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!eventTrigger) {
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

  return (
    <div className="w-full px-10 py-8">
      <div className="mx-auto w-full max-w-5xl rounded-lg bg-background p-4">
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
            <TabsTrigger value="pending-processed-events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <EventTriggerOverview eventTrigger={eventTrigger} />
          </TabsContent>
          <TabsContent value="pending-processed-events">
            <EventTriggerEventsDataTable eventTrigger={eventTrigger} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
