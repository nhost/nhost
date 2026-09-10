import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { BackupsPageLayout } from '@/features/orgs/projects/backups/components/BackupsPageLayout';
import { BackupsSidebar } from '@/features/orgs/projects/backups/components/BackupsSidebar';
import { ImportBackupContent } from '@/features/orgs/projects/backups/components/ImportBackupContent';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';

export default function ImportBackupPage() {
  return (
    <BackupsPageLayout>
      <ImportBackupContent />
    </BackupsPageLayout>
  );
}

ImportBackupPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <BackupsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
