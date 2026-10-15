import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from 'next/router';
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
  const router = useRouter();
  const { eventTriggerSlug } = router.query;

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <EventTriggerView key={eventTriggerSlug as string} />
    </RetryableErrorBoundary>
  );
}
