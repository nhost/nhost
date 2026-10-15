import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas',
)({
  component: RemoteSchemaBrowserLayout,
});

function RemoteSchemaBrowserLayout() {
  return (
    <div className="flex h-full">
      <RemoteSchemaBrowserSidebar />
      <div className="flex w-full flex-auto flex-col overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
