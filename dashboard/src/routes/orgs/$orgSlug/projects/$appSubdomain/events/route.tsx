import { createFileRoute, Outlet } from '@tanstack/react-router';
import { EventsArea } from '@/features/orgs/projects/events/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/events',
)({
  component: EventsAreaLayout,
});

function EventsAreaLayout() {
  return (
    <EventsArea>
      <Outlet />
    </EventsArea>
  );
}
