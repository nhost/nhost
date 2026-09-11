import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function Editor() {
  const { project } = useProject();

  if (!project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return <SQLEditor hideEmptyResults />;
}

Editor.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <ContentPanel>
            <div className="flex flex-row w-full h-full">
              <RetryableErrorBoundary>
                <div className="flex w-full flex-col overflow-x-hidden">{page}</div>
              </RetryableErrorBoundary>
            </div>
          </ContentPanel>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
