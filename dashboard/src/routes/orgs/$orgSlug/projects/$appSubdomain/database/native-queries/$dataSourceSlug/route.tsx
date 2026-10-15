import { createFileRoute, Outlet } from '@tanstack/react-router';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug',
)({
  component: NativeQueriesBrowserLayout,
});

function NativeQueriesBrowserLayout() {
  return (
    <div className="flex h-full">
      <NativeQueriesBrowserSidebar />
      <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
        <Outlet />
      </div>
    </div>
  );
}
