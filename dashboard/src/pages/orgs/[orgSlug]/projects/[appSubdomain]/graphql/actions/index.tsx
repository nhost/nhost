import type { ReactElement } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/actions/components/ActionsBrowserSidebar';
import { NoActionsEmptyState } from '@/features/orgs/projects/actions/components/NoActionsEmptyState';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';

export default function ActionsPage() {
  const { data: actionsData, isLoading } = useGetActions();

  if (isLoading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading actions..."
        className="justify-center"
      />
    );
  }

  const hasActions = (actionsData?.actions.length ?? 0) > 0;

  if (!hasActions) {
    return <NoActionsEmptyState />;
  }

  return (
    <NoActionsEmptyState
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
