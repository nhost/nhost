import { createFileRoute, Outlet } from '@tanstack/react-router';
import { StorageLayout } from '@/features/orgs/projects/storage/components/StorageLayout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets',
)({
  component: BucketsLayout,
});

function BucketsLayout() {
  return (
    <div className="flex h-full">
      <StorageLayout>
        <Outlet />
      </StorageLayout>
    </div>
  );
}
