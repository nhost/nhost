import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/graphql/actions/components/ActionsBrowserSidebar';
import { CustomTypesEditor } from '@/features/orgs/projects/graphql/actions/components/CustomTypesEditor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CustomTypesEditorPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <CustomTypesEditor />
    </RetryableErrorBoundary>
  );
}

CustomTypesEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full">
            <ActionsBrowserSidebar />
            <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
              {page}
            </div>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
