import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database',
)({
  component: DatabaseAreaLayout,
});

function DatabaseAreaLayout() {
  return (
    <DatabaseArea>
      <Outlet />
    </DatabaseArea>
  );
}
