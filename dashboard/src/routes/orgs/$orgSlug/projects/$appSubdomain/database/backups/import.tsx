import { createFileRoute } from '@tanstack/react-router';
import { BackupsPageLayout } from '@/features/orgs/projects/database/backups/components/BackupsPageLayout';
import { ImportBackupContent } from '@/features/orgs/projects/database/backups/components/ImportBackupContent';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups/import',
)({
  component: ImportBackupPage,
});

function ImportBackupPage() {
  return (
    <BackupsPageLayout>
      <ImportBackupContent />
    </BackupsPageLayout>
  );
}
