import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AreaSidebarLayout } from '@/features/orgs/projects/common/layout/AreaSidebarLayout';
import { BackupsSidebar } from '@/features/orgs/projects/database/backups/components/BackupsSidebar';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups',
)({
  component: BackupsLayout,
});

function BackupsLayout() {
  return (
    <AreaSidebarLayout sidebar={<BackupsSidebar />}>
      <Outlet />
    </AreaSidebarLayout>
  );
}
