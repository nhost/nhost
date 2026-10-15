import { createFileRoute, Outlet } from '@tanstack/react-router';
import { FunctionsBrowserSidebar } from '@/features/orgs/projects/serverless-functions/components/FunctionsBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/functions/browser',
)({
  component: FunctionsBrowserLayout,
});

function FunctionsBrowserLayout() {
  return (
    <div className="flex h-full">
      <FunctionsBrowserSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
