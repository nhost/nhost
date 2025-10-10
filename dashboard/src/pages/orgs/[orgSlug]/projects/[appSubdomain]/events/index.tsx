import { Box } from '@/components/ui/v2/Box';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { EventsBrowserSidebar } from '@/features/orgs/projects/events/common/components/EventsBrowserSidebar';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import type { ReactElement } from 'react';

export default function EventsPage() {
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
