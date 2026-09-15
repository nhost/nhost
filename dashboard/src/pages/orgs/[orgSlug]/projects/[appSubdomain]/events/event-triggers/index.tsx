import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { EventTriggersBrowserSidebar } from '@/features/orgs/projects/events/event-triggers/components/EventTriggersBrowserSidebar';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';

export default function EventTriggersPage() {
  const {
    data: eventTriggers,
    isLoading: isLoadingEventTriggers,
    error: errorEventTriggers,
  } = useGetEventTriggers();

  if (isLoadingEventTriggers) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (errorEventTriggers instanceof Error) {
    return (
      <EventsEmptyState
        title="Event triggers"
        description="An error occurred while fetching event triggers."
      />
    );
  }

  const showNoEventTriggersMessage =
    Array.isArray(eventTriggers) && eventTriggers.length === 0;

  if (showNoEventTriggersMessage) {
    return (
      <EventsEmptyState
        title="Event triggers"
        description="Add an event trigger to get started."
      />
    );
  }

  return (
    <EventsEmptyState
      title="Event triggers"
      description="Select an event trigger from the sidebar to get started."
    />
  );
}

EventTriggersPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectViewWithState>
          <div className="flex h-full">
            <EventTriggersBrowserSidebar />
            <div className="box flex w-full flex-auto flex-col overflow-x-hidden bg-default">
              {page}
            </div>
          </div>
        </ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
