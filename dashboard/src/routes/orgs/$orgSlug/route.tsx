import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/orgs/$orgSlug')({
  component: OrganizationLayout,
});

function OrganizationLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
