import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ActionsEmptyState } from '@/features/orgs/projects/graphql/actions/components/ActionsEmptyState';
import { NoActionsEmptyState } from '@/features/orgs/projects/graphql/actions/components/NoActionsEmptyState';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/',
)({
  component: ActionsPage,
});

function ActionsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const { data: actionsData, isLoading, error } = useGetActions();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error instanceof Error) {
    return (
      <ActionsEmptyState
        title="Something went wrong"
        description="Actions could not be loaded. Please try again."
      />
    );
  }

  const actionsEmpty = (actionsData?.actions.length ?? 0) === 0;

  if (actionsEmpty) {
    return <NoActionsEmptyState />;
  }

  return (
    <ActionsEmptyState
      title="Actions"
      description="Select an action from the sidebar, or create a new one."
    />
  );
}
