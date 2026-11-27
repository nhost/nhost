import { Pencil } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { PaginationControls } from '@/features/orgs/projects/events/common/components/PaginationControls';
import { useEventPagination } from '@/features/orgs/projects/events/common/hooks/useEventPagination';
import { useGetScheduledEventLogsQuery } from '@/features/orgs/projects/events/common/hooks/useGetScheduledEventLogsQuery';
import CronJobPaneHeader from '@/features/orgs/projects/events/cron-jobs/components/CronJobPaneHeader';
import {
  CronJobPaneTab,
  CronJobPaneTabs,
} from '@/features/orgs/projects/events/cron-jobs/components/CronJobPaneTabs';
import DeleteJobButton from '@/features/orgs/projects/events/cron-jobs/components/DeleteJobButton';
import JobIconButton from '@/features/orgs/projects/events/cron-jobs/components/JobIconButton';
import { CronTriggerEventsDataTable } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerEventsDataTable';
import type { CronTriggerEventsSection } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerEventsDataTable/cronTriggerEventsDataTableColumns';
import { DeleteCronTriggerDialog } from '@/features/orgs/projects/events/cron-triggers/components/DeleteCronTriggerDialog';
import { EditCronTriggerForm } from '@/features/orgs/projects/events/cron-triggers/components/EditCronTriggerForm';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import CronTriggerViewSkeleton from './CronTriggerViewSkeleton';
import CronTriggerOverview from './sections/CronTriggerOverview';

export default function CronTriggerView() {
  const router = useRouter();

  const { cronTriggerSlug } = router.query;

  const { data: cronTriggers, isLoading, error } = useGetCronTriggers();

  const cronTrigger = cronTriggers?.find(
    (trigger) => trigger.name === cronTriggerSlug,
  );

  const [deleting, setDeleting] = useState(false);
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
    error: eventsError,
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

  if (eventsError) {
    throw eventsError;
  }

  if (isLoading && cronTriggerSlug) {
    return <CronTriggerViewSkeleton />;
  }

  if (error instanceof Error) {
    return (
      <EventsEmptyState
        title="Webhook job not found"
        description={
          <span>
            Webhook job{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              {cronTriggerSlug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  if (!cronTrigger) {
    return (
      <EventsEmptyState
        title="Webhook job not found"
        description={
          <span>
            Webhook job{' '}
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
    <div className="flex min-h-full w-full flex-col bg-background">
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-full flex-col gap-0"
      >
        <CronJobPaneHeader
          title={cronTrigger.name}
          description={cronTrigger.comment}
          actions={
            <>
              <EditCronTriggerForm
                cronTrigger={cronTrigger}
                trigger={({ open }) => (
                  <JobIconButton label="Edit job" onClick={open}>
                    <Pencil />
                  </JobIconButton>
                )}
              />
              <DeleteJobButton onClick={() => setDeleting(true)} />
              <DeleteCronTriggerDialog
                open={deleting}
                setOpen={setDeleting}
                cronTriggerToDelete={cronTrigger.name}
              />
            </>
          }
        >
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <CronJobPaneTabs aria-label="Job details">
              <CronJobPaneTab value="overview">Overview</CronJobPaneTab>
              <CronJobPaneTab value="pending-processed-events">
                Events
              </CronJobPaneTab>
            </CronJobPaneTabs>
          </div>
        </CronJobPaneHeader>
        <TabsContent value="overview" className="p-6">
          <CronTriggerOverview cronTrigger={cronTrigger} />
        </TabsContent>
        <TabsContent className="mt-0 flex-1" value="pending-processed-events">
          <CronTriggerEventsDataTable
            triggerName={cronTrigger.name}
            eventLogsSection={eventLogsSection}
            onEventLogsSectionChange={setEventLogsSection}
            data={eventsData}
            isLoading={isEventsLoading}
            limit={limit}
          />
          <PaginationControls
            className="justify-end px-6 pt-0 pb-6"
            offset={offset}
            limit={limit}
            hasNoPreviousPage={hasNoPreviousPage}
            hasNoNextPage={hasNoNextPage}
            onPrev={goPrev}
            onNext={() => !hasNoNextPage && goNext()}
            onChangeLimit={setLimitAndReset}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
