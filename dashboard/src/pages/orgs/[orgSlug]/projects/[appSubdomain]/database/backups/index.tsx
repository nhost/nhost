import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { BackupsPageLayout } from '@/features/orgs/projects/database/backups/components/BackupsPageLayout';
import { BackupsSidebar } from '@/features/orgs/projects/database/backups/components/BackupsSidebar';
import { ScheduledBackupsContent } from '@/features/orgs/projects/database/backups/components/ScheduledBackupsContent';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';

export default function ScheduledBackupsPage() {
  return (
    <BackupsPageLayout>
      <ScheduledBackupsContent />
    </BackupsPageLayout>
  );
}

ScheduledBackupsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col md:flex-row">
            <BackupsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
