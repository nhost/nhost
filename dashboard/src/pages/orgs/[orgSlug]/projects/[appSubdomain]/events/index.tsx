import { Box } from '@/components/ui/v2/Box';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { EventsBrowserSidebar } from '@/features/orgs/projects/events/common/components/EventsBrowserSidebar';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';

import type { ReactElement } from 'react';

export default function EventsPage() {
  const { data: eventTriggers, isLoading, error } = useGetEventTriggers();

  if (isLoading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <EventsEmptyState
        title="Events"
        description="An error occurred while fetching events."
      />
    );
  }

  if (Array.isArray(eventTriggers) && eventTriggers.length === 0) {
    return (
      <EventsEmptyState
        title="Events"
        description="Add an event to get started."
      />
    );
  }

  return (
    <EventsEmptyState
      title="Events"
      description="Select an event from the sidebar to get started."
    />
  );
}

EventsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <EventsBrowserSidebar className="w-full max-w-sidebar" />
      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {page}
      </Box>
    </OrgLayout>
  );
};
