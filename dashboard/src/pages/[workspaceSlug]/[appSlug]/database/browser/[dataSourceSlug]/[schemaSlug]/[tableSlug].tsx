import { LoadingScreen } from '@/components/common/LoadingScreen';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import DataBrowserGrid from '@/components/dataBrowser/DataBrowserGrid';
import DataBrowserLayout from '@/components/dataBrowser/DataBrowserLayout';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import useTablePath from '@/hooks/useTablePath';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
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
  return <DataBrowserLayout>{page}</DataBrowserLayout>;
};
