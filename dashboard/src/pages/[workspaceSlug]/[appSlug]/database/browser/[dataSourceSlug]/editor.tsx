import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
// import { useTablePath } from '@/features/database/common/hooks/useTablePath';
import { DataBrowserLayout } from '@/features/database/dataGrid/components/DataBrowserLayout';
import { SQLEditor } from '@/features/database/dataGrid/components/SQLEditor';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { ReactElement } from 'react';

export default function Editor() {
  // SQL editor should support migrations only if launched locally with the cli
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  if (isPlatform && !currentProject?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      {/* <DataBrowserGrid sortBy={sortBy} onSort={handleSortByChange} /> */}
      <SQLEditor />
    </RetryableErrorBoundary>
  );
}

Editor.getLayout = function getLayout(page: ReactElement) {
  return <DataBrowserLayout>{page}</DataBrowserLayout>;
};
