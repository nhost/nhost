import { createFileRoute, useParams } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CronTriggerView } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/$cronTriggerSlug',
)({
  component: CronTriggerDetailsPage,
});

function CronTriggerDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { cronTriggerSlug } = useParams({ strict: false });

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <CronTriggerView key={cronTriggerSlug as string} />
    </RetryableErrorBoundary>
  );
}
