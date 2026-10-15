import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { NoLogicalModelsEmptyState } from '@/features/orgs/projects/database/native-queries/components/NoLogicalModelsEmptyState';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/',
)({
  component: NativeQueriesIndexPage,
});

function NativeQueriesIndexContent() {
  const { data: models = [], isLoading, error } = useGetLogicalModels();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error instanceof Error) {
    return (
      <NativeQueriesEmptyState
        title="Something went wrong"
        description="Logical models could not be loaded. Please try again."
      />
    );
  }

  if (models.length === 0) {
    return <NoLogicalModelsEmptyState />;
  }

  return (
    <NativeQueriesEmptyState
      title="Native queries"
      description="Select a logical model or native query from the sidebar, or create a new one."
    />
  );
}

function NativeQueriesIndexPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { dataSourceSlug } = Route.useParams();

  if (dataSourceSlug !== 'default') {
    return (
      <NativeQueriesEmptyState
        title="Database not found"
        description={
          <span>
            Database <InlineCode>{dataSourceSlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return <NativeQueriesIndexContent />;
}
