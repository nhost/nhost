import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserGridContainer } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function DataBrowserTableDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <DataBrowserGridContainer />
    </RetryableErrorBoundary>
  );
}

DataBrowserTableDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectViewWithState>
          <div className="flex h-full">
            <DataBrowserSidebar />
            <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
              {page}
            </div>
          </div>
        </ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
