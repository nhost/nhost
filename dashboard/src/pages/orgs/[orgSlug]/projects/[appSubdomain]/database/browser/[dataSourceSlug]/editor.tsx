import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function Editor() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return <SQLEditor />;
}

Editor.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />
      <RetryableErrorBoundary>
        <div className="flex w-full flex-col">{page}</div>
      </RetryableErrorBoundary>
    </OrgLayout>
  );
};
