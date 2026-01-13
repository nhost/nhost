import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { EventTriggersBrowserSidebar } from '@/features/orgs/projects/events/event-triggers/components/EventTriggersBrowserSidebar';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';

import type { ReactElement } from 'react';

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
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <EventTriggersBrowserSidebar className="w-full max-w-sidebar" />

      <div className="box flex w-full flex-auto flex-col overflow-x-hidden bg-default">
        {page}
      </div>
    </OrgLayout>
  );
};
