import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserGrid } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { SortingRule } from 'react-table';

export default function DataBrowserTableDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const tablePath = useTablePath();
  const [sortBy, setSortBy] = useState<SortingRule<any>[]>();

  const handleSortByChange = useCallback((args: SortingRule<any>[]) => {
    setSortBy(args);
  }, []);

  useEffect(() => {
    setSortBy(undefined);
  }, [tablePath]);

  if (isPlatform && !project?.config?.hasura.adminSecret) {
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
