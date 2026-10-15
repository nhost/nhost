import { createFileRoute } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/v3/spinner';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/',
)({
  component: CronTriggersPage,
});

function CronTriggersPage() {
  const {
    data: cronTriggers,
    isLoading: isLoadingCronTriggers,
    error: errorCronTriggers,
  } = useGetCronTriggers();

  if (isLoadingCronTriggers) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (errorCronTriggers instanceof Error) {
    return (
      <EventsEmptyState
        title="Cron triggers"
        description="An error occurred while fetching cron triggers."
      />
    );
  }

  const showNoCronTriggersMessage =
    Array.isArray(cronTriggers) && cronTriggers.length === 0;

  if (showNoCronTriggersMessage) {
    return (
      <EventsEmptyState
        title="Cron triggers"
        description="Add a cron trigger to get started."
      />
    );
  }

  return (
    <EventsEmptyState
      title="Cron triggers"
      description="Select a cron trigger from the sidebar to get started."
    />
  );
}
