import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { PaginationControls } from '@/features/orgs/projects/events/common/components/PaginationControls';
import { useEventPagination } from '@/features/orgs/projects/events/common/hooks/useEventPagination';
import { useGetScheduledEventLogsQuery } from '@/features/orgs/projects/events/common/hooks/useGetScheduledEventLogsQuery';
import { CronTriggerEventsDataTable } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerEventsDataTable';
import type { CronTriggerEventsSection } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerEventsDataTable/cronTriggerEventsDataTableColumns';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import { isEmptyValue } from '@/lib/utils';
import CronTriggerViewSkeleton from './CronTriggerViewSkeleton';
import CronTriggerOverview from './sections/CronTriggerOverview';

export default function CronTriggerView() {
  const router = useRouter();

  const { cronTriggerSlug } = router.query;

  const { data: cronTriggers, isLoading, error } = useGetCronTriggers();

  const cronTrigger = cronTriggers?.find(
    (trigger) => trigger.name === cronTriggerSlug,
  );

  const [tab, setTab] = useState('overview');
  const [eventLogsSection, setEventLogsSection] =
    useState<CronTriggerEventsSection>('processed');

  const triggerName = cronTrigger?.name ?? '';

  const isEventsTab = tab === 'pending-processed-events';

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
    useQueryHook: useGetScheduledEventLogsQuery,
    getQueryArgs: (limitArg, offsetArg) => ({
      type: 'cron' as const,
      trigger_name: triggerName,
      eventLogsSection,
      limit: limitArg,
      offset: offsetArg,
    }),
    queryOptions: {
      enabled: isEventsTab && !!triggerName,
    },
    resetKey: `${triggerName}:${eventLogsSection}`,
  });

  if (isLoading && cronTriggerSlug) {
    return <CronTriggerViewSkeleton />;
  }

  if (error instanceof Error) {
    return (
      <EventsEmptyState
        title="Cron trigger not found"
        description={
          <span>
            Cron trigger{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              {cronTriggerSlug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  if (isEmptyValue(cronTrigger)) {
    return (
      <EventsEmptyState
        title="Cron trigger not found"
        description={
          <span>
            Cron trigger{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              {cronTriggerSlug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
        <div className="sticky top-0 z-10 border-b-1 bg-background">
          <div className="p-6">
            <h1 className="mb-1 font-semibold text-gray-900 text-xl dark:text-gray-100">
              {cronTrigger!.name}
            </h1>
            <p className="text-gray-600 text-sm dark:text-gray-400">
              Cron Trigger Configuration
            </p>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 px-6 py-4 lg:flex-row lg:items-center">
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
        </div>

        <TabsContent value="overview" className="overflow-auto p-6">
          <CronTriggerOverview cronTrigger={cronTrigger!} />
        </TabsContent>
        <TabsContent
          className="mt-0 flex-1 overflow-auto"
          value="pending-processed-events"
        >
          <CronTriggerEventsDataTable
            eventLogsSection={eventLogsSection}
            onEventLogsSectionChange={setEventLogsSection}
            data={eventsData}
            isLoading={isEventsLoading}
            limit={limit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
