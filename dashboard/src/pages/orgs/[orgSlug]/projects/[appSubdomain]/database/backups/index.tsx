import type { ReactElement } from 'react';
import { BackupsPageLayout } from '@/features/orgs/projects/backups/components/BackupsPageLayout';
import { BackupsSidebar } from '@/features/orgs/projects/backups/components/BackupsSidebar';
import { ScheduledBackupsContent } from '@/features/orgs/projects/backups/components/ScheduledBackupsContent';
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';

export default function ScheduledBackupsPage() {
  return (
    <BackupsPageLayout>
      <ScheduledBackupsContent />
    </BackupsPageLayout>
  );
}

ScheduledBackupsPage.getLayout = function getLayout(page: ReactElement) {
  return getDatabaseLayout(page, {
    sidebar: <BackupsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
  });
};
