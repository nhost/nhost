import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MetricsArea } from '@/features/orgs/projects/metrics/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/metrics',
)({
  component: MetricsAreaLayout,
});

function MetricsAreaLayout() {
  return (
    <MetricsArea>
      <Outlet />
    </MetricsArea>
  );
}
