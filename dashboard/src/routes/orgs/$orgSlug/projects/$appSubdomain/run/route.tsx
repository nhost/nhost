import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RunArea } from '@/features/orgs/projects/run/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/run',
)({
  component: RunAreaLayout,
});

function RunAreaLayout() {
  return (
    <RunArea>
      <Outlet />
    </RunArea>
  );
}
