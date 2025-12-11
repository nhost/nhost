import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { CronTriggerEventsDataTable } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerEventsDataTable';
import CronTriggerViewSkeleton from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerView/CronTriggerViewSkeleton';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import { isEmptyValue } from '@/lib/utils';
import { useRouter } from 'next/router';
import CronTriggerOverview from './sections/CronTriggerOverview';

export default function CronTriggerView() {
  const router = useRouter();

  const { cronTriggerSlug } = router.query;

  const { data: cronTriggers, isLoading, error } = useGetCronTriggers();

  const cronTrigger = cronTriggers?.find(
    (trigger) => trigger.name === cronTriggerSlug,
  );

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
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium">
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
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium">
              {cronTriggerSlug}
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
            {cronTrigger!.name}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Cron Trigger Configuration
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pending-processed-events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <CronTriggerOverview cronTrigger={cronTrigger!} />
          </TabsContent>
          <TabsContent value="pending-processed-events">
            <CronTriggerEventsDataTable cronTrigger={cronTrigger!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
