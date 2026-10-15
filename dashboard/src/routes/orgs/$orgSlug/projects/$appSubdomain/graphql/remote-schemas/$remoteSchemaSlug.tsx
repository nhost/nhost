import { createFileRoute } from '@tanstack/react-router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RemoteSchemaDetails } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaDetails';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas/$remoteSchemaSlug',
)({
  component: RemoteSchemaDetailsPage,
});

function RemoteSchemaDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return (
      <div className="absolute inset-0 z-50 flex h-full w-full items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <RetryableErrorBoundary>
      <RemoteSchemaDetails />
    </RetryableErrorBoundary>
  );
}
