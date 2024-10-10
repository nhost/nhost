import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { useTablePath } from '@/features/database/common/hooks/useTablePath';
import { DataBrowserGrid } from '@/features/database/dataGrid/components/DataBrowserGrid';
import { DataBrowserSidebar } from '@/features/database/dataGrid/components/DataBrowserSidebar';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { SortingRule } from 'react-table';

export default function DataBrowserTableDetailsPage() {
  const isPlatform = useIsPlatform();
  const tablePath = useTablePath();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [sortBy, setSortBy] = useState<SortingRule<any>[]>();

  const handleSortByChange = useCallback((args: SortingRule<any>[]) => {
    setSortBy(args);
  }, []);

  useEffect(() => {
    setSortBy(undefined);
  }, [tablePath]);

  if (isPlatform && !currentProject?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <DataBrowserGrid sortBy={sortBy} onSort={handleSortByChange} />
    </RetryableErrorBoundary>
  );
}

DataBrowserTableDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {page}
      </Box>
    </ProjectLayout>
  );
};
