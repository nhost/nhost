import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { OneOffsView } from '@/features/orgs/projects/events/one-offs/components/OneOffsView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CronTriggersPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <OneOffsView />
    </RetryableErrorBoundary>
  );
}

CronTriggersPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {page}
      </div>
    </ProjectLayout>
  );
};
