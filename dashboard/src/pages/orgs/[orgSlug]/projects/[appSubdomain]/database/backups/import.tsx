import type { ReactElement } from 'react';
import { BackupsPageLayout } from '@/features/orgs/projects/backups/components/BackupsPageLayout';
import { BackupsSidebar } from '@/features/orgs/projects/backups/components/BackupsSidebar';
import { ImportBackupContent } from '@/features/orgs/projects/backups/components/ImportBackupContent';
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';

export default function ImportBackupPage() {
  return (
    <BackupsPageLayout>
      <ImportBackupContent />
    </BackupsPageLayout>
  );
}

ImportBackupPage.getLayout = function getLayout(page: ReactElement) {
  return getDatabaseLayout(page, {
    sidebar: <BackupsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
  });
};
