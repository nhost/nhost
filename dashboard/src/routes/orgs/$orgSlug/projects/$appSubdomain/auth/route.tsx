import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthArea } from '@/features/orgs/projects/authentication/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/auth',
)({
  component: AuthAreaLayout,
});

function AuthAreaLayout() {
  return (
    <AuthArea>
      <Outlet />
    </AuthArea>
  );
}
