import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserGrid } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid';
// import { DataBrowserLayout } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserLayout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { SortingRule } from 'react-table';

export default function DataBrowserTableDetailsPage() {
  const isPlatform = useIsPlatform();
  const tablePath = useTablePath();
  const { project } = useProject();

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
  return <ProjectLayout>{page}</ProjectLayout>;
};
