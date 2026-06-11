import type { ReactElement } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/actions/components/ActionsBrowserSidebar';
import { ActionsEmptyState } from '@/features/orgs/projects/actions/components/ActionsEmptyState';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';

export default function ActionsPage() {
  const { isLoading } = useGetActions();

  if (isLoading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading actions..."
        className="justify-center"
      />
    );
  }

  return (
    <ActionsEmptyState
      title="Actions"
      description="Select an action from the sidebar to get started."
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

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {page}
      </Box>
    </OrgLayout>
  );
};
