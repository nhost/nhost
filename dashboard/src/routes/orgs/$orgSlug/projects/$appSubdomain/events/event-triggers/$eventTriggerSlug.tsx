import { createFileRoute, useParams } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { EventTriggerView } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers/$eventTriggerSlug',
)({
  component: EventTriggerDetailsPage,
});

function EventTriggerDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { eventTriggerSlug } = useParams({ strict: false });

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <EventTriggerView key={eventTriggerSlug as string} />
    </RetryableErrorBoundary>
  );
}
