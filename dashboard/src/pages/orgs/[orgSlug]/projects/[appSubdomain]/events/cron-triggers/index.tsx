import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { CronTriggersBrowserSidebar } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggersBrowserSidebar';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import { EventsArea } from '@/features/orgs/projects/events/layout';

export default function CronTriggersPage() {
  const {
    data: cronTriggers,
    isLoading: isLoadingCronTriggers,
    error: errorCronTriggers,
  } = useGetCronTriggers();

  if (isLoadingCronTriggers) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (errorCronTriggers instanceof Error) {
    return (
      <EventsEmptyState
        title="Cron triggers"
        description="An error occurred while fetching cron triggers."
      />
    );
  }

  const showNoCronTriggersMessage =
    Array.isArray(cronTriggers) && cronTriggers.length === 0;

  if (showNoCronTriggersMessage) {
    return (
      <EventsEmptyState
        title="Cron triggers"
        description="Add a cron trigger to get started."
      />
    );
  }

  return (
    <EventsEmptyState
      title="Cron triggers"
      description="Select a cron trigger from the sidebar to get started."
    />
  );
}

CronTriggersPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <EventsArea>
          <ContentPanel>
            <div className="flex h-full">
              <CronTriggersBrowserSidebar />
              <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
                {page}
              </div>
            </div>
          </ContentPanel>
        </EventsArea>
      </ProjectScope>
    </AppLayout>
  );
};
