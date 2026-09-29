import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { EventTriggersBrowserSidebar } from '@/features/orgs/projects/events/event-triggers/components/EventTriggersBrowserSidebar';
import { EventTriggerView } from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function EventTriggerDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const router = useRouter();
  const { eventTriggerSlug } = router.query;

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <EventTriggerView key={eventTriggerSlug as string} />
    </RetryableErrorBoundary>
  );
}

EventTriggerDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full">
            <EventTriggersBrowserSidebar />
            <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
              {page}
            </div>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
