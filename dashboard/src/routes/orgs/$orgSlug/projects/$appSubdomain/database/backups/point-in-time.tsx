import { createFileRoute } from '@tanstack/react-router';
import { BackupsPageLayout } from '@/features/orgs/projects/database/backups/components/BackupsPageLayout';
import { PointInTimeBackupsContent } from '@/features/orgs/projects/database/backups/components/PointInTimeBackupsContent';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups/point-in-time',
)({
  component: PointInTimeBackupsPage,
});

function PointInTimeBackupsPage() {
  return (
    <BackupsPageLayout>
      <PointInTimeBackupsContent />
    </BackupsPageLayout>
  );
}
