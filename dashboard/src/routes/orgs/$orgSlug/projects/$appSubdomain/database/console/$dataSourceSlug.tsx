import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/console/$dataSourceSlug',
)({
  component: RouteComponent,
});

function Editor() {
  const { project } = useProject();

  if (!project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return <SQLEditor hideEmptyResults />;
}

function RouteComponent() {
  return (
    <div className="flex h-full w-full flex-row">
      <RetryableErrorBoundary>
        <div className="flex w-full flex-col overflow-x-hidden">
          <Editor />
        </div>
      </RetryableErrorBoundary>
    </div>
  );
}
