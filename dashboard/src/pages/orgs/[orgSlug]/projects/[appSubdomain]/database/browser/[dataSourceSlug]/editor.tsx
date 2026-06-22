import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function Editor() {
  const { project } = useProject();

  if (!project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return <SQLEditor />;
}

Editor.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <DataBrowserSidebar />
      <RetryableErrorBoundary>
        <div className="flex w-full flex-col overflow-x-hidden">{page}</div>
      </RetryableErrorBoundary>
    </OrgLayout>
  );
};
