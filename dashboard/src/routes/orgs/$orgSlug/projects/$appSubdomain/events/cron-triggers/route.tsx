import { createFileRoute, Outlet } from '@tanstack/react-router';
import { CronTriggersBrowserSidebar } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggersBrowserSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers',
)({
  component: CronTriggersBrowserLayout,
});

function CronTriggersBrowserLayout() {
  return (
    <div className="flex h-full">
      <CronTriggersBrowserSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
