import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserGridContainer } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/tables/$tableSlug',
)({
  component: DataBrowserTableDetailsPage,
});

function DataBrowserTableDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <DataBrowserGridContainer />
    </RetryableErrorBoundary>
  );
}
