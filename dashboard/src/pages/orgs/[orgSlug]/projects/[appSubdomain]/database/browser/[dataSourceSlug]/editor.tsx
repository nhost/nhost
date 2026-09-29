import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
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
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full w-full flex-row">
            <DataBrowserSidebar />
            <RetryableErrorBoundary>
              <div className="flex w-full flex-col overflow-x-hidden">
                {page}
              </div>
            </RetryableErrorBoundary>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
