import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { PaginationControls } from '@/features/orgs/projects/events/common/components/PaginationControls';
import { useEventPagination } from '@/features/orgs/projects/events/common/hooks/useEventPagination';
import { EventTriggerEventsDataTable } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerEventsDataTable';
import EventTriggerViewSkeleton from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView/EventTriggerViewSkeleton';
import EventTriggerOverview from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView/sections/EventTriggerOverview';
import useGetEventLogsQuery from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventLogsQuery/useGetEventLogsQuery';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import { isEmptyValue } from '@/lib/utils';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function EventTriggerView() {
  const router = useRouter();

  const { eventTriggerSlug } = router.query;

  const { data: eventTriggers, isLoading, error } = useGetEventTriggers();

  const eventTrigger = eventTriggers?.find(
    (trigger) => trigger.name === eventTriggerSlug,
  );

  const [tab, setTab] = useState('overview');
  const isEventsTab = tab === 'pending-processed-events';
  const triggerName = eventTrigger?.name ?? '';
  const dataSource = eventTrigger?.dataSource ?? '';

  const {
    offset,
    limit,
    setLimitAndReset,
    goPrev,
    goNext,
    hasNoPreviousPage,
    hasNoNextPage,
    data: eventsData,
    isLoading: isEventsLoading,
  } = useEventPagination({
    initialLimit: 10,
    useQueryHook: useGetEventLogsQuery,
    getQueryArgs: (limitArg, offsetArg) => ({
      name: triggerName,
      limit: limitArg,
      offset: offsetArg,
      source: dataSource,
    }),
    queryOptions: {
      queryOptions: {
        enabled: isEventsTab && !!triggerName,
      },
    },
    resetKey: `${dataSource}:${triggerName}`,
  });

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
    <div className="w-full bg-background">
      <div className="p-6">
        <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
          {eventTrigger!.name}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Event Trigger Configuration
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col items-start justify-between gap-4 px-6 lg:flex-row lg:items-center">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pending-processed-events">Events</TabsTrigger>
          </TabsList>

          {tab === 'pending-processed-events' && (
            <PaginationControls
              className="px-0 py-0"
              offset={offset}
              limit={limit}
              hasNoPreviousPage={hasNoPreviousPage}
              hasNoNextPage={hasNoNextPage}
              onPrev={goPrev}
              onNext={() => !hasNoNextPage && goNext()}
              onChangeLimit={setLimitAndReset}
            />
          )}
        </div>
        <TabsContent value="overview" className="p-6">
          <EventTriggerOverview eventTrigger={eventTrigger!} />
        </TabsContent>
        <TabsContent value="pending-processed-events">
          <EventTriggerEventsDataTable
            eventTrigger={eventTrigger!}
            data={eventsData}
            isLoading={isEventsLoading}
            limit={limit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
