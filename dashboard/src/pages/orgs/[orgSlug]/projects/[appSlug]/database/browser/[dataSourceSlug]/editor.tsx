import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { ReactElement } from 'react';

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
    <ProjectLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />
      <RetryableErrorBoundary>
        <div className="flex w-full flex-col">{page}</div>
      </RetryableErrorBoundary>
    </ProjectLayout>
  );
};
