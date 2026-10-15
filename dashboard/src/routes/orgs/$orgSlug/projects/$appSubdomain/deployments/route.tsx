import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DeploymentsArea } from '@/features/orgs/projects/deployments/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/deployments',
)({
  component: DeploymentsAreaLayout,
});

function DeploymentsAreaLayout() {
  return (
    <DeploymentsArea>
      <Outlet />
    </DeploymentsArea>
  );
}
