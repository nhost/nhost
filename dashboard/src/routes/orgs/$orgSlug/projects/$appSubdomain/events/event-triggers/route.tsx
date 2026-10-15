import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EventTriggersBrowserSidebar } from '@/features/orgs/projects/events/event-triggers/components/EventTriggersBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers',
)({
  component: EventTriggersBrowserLayout,
});

function EventTriggersBrowserLayout() {
  return (
    <div className="flex h-full">
      <EventTriggersBrowserSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
