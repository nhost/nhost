import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/graphql/actions/components/ActionsBrowserSidebar';
import { ActionsEmptyState } from '@/features/orgs/projects/graphql/actions/components/ActionsEmptyState';
import { NoActionsEmptyState } from '@/features/orgs/projects/graphql/actions/components/NoActionsEmptyState';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function ActionsPage() {
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
        description="The actions could not be loaded. Please try again."
      />
    );
  }

  const hasActions = (actionsData?.actions.length ?? 0) > 0;

  if (!hasActions) {
    return <NoActionsEmptyState />;
  }

  return (
    <ActionsEmptyState
      title="Actions"
      description="Select an action from the sidebar, or create a new one."
    />
  );
}

ActionsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <ActionsBrowserSidebar />

      <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
        {page}
      </div>
    </OrgLayout>
  );
};
