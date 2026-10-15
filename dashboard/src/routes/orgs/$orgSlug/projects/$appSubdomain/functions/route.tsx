import { createFileRoute, Outlet } from '@tanstack/react-router';
import { FunctionsArea } from '@/features/orgs/projects/serverless-functions/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/functions',
)({
  component: FunctionsAreaLayout,
});

function FunctionsAreaLayout() {
  return (
    <FunctionsArea>
      <Outlet />
    </FunctionsArea>
  );
}
