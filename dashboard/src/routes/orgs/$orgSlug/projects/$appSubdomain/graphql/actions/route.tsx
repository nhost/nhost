import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/graphql/actions/components/ActionsBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions',
)({
  component: ActionsBrowserLayout,
});

function ActionsBrowserLayout() {
  return (
    <div className="flex h-full">
      <ActionsBrowserSidebar />
      <div className="flex w-full flex-auto flex-col overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
