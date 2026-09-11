import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CronTriggersBrowserSidebar } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggersBrowserSidebar';
import { CronTriggerView } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CronTriggerDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const router = useRouter();
  const { cronTriggerSlug } = router.query;

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <CronTriggerView key={cronTriggerSlug as string} />
    </RetryableErrorBoundary>
  );
}

CronTriggerDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectViewWithState>
          <div className="flex h-full">
            <CronTriggersBrowserSidebar />
            <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
              {page}
            </div>
          </div>
        </ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
