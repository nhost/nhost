import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug',
)({
  component: DataBrowserLayout,
});

function DataBrowserLayout() {
  return (
    <div className="flex h-full">
      <DataBrowserSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
