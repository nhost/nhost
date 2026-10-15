import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { FunctionDefinitionView } from '@/features/orgs/projects/database/dataGrid/components/FunctionDefinitionView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/functions/$functionOID',
)({
  component: DataBrowserFunctionDetailsPage,
});

function DataBrowserFunctionDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <FunctionDefinitionView />
    </RetryableErrorBoundary>
  );
}
