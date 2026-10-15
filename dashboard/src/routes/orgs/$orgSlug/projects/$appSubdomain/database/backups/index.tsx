import { createFileRoute } from '@tanstack/react-router';
import { BackupsPageLayout } from '@/features/orgs/projects/database/backups/components/BackupsPageLayout';
import { ScheduledBackupsContent } from '@/features/orgs/projects/database/backups/components/ScheduledBackupsContent';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups/',
)({
  component: ScheduledBackupsPage,
});

function ScheduledBackupsPage() {
  return (
    <BackupsPageLayout>
      <ScheduledBackupsContent />
    </BackupsPageLayout>
  );
}
