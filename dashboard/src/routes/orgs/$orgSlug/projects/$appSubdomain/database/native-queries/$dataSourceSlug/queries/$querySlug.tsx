import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { NativeQueryDetails } from '@/features/orgs/projects/database/native-queries/components/NativeQueryDetails';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/queries/$querySlug',
)({
  component: NativeQueryDetailsPage,
});

function NativeQueryDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <NativeQueryDetails />
    </RetryableErrorBoundary>
  );
}
