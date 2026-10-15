import { createFileRoute, Outlet } from '@tanstack/react-router';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';

export const Route = createFileRoute('/orgs/$orgSlug/_org')({
  component: OrganizationScopeLayout,
});

function OrganizationScopeLayout() {
  return (
    <OrganizationScope>
      <Outlet />
    </OrganizationScope>
  );
}
