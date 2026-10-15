import { createFileRoute, Outlet } from '@tanstack/react-router';
import { StorageArea } from '@/features/orgs/projects/storage/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/storage',
)({
  component: StorageAreaLayout,
});

function StorageAreaLayout() {
  return (
    <StorageArea>
      <Outlet />
    </StorageArea>
  );
}
