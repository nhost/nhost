import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { AreaSidebarLayout } from '@/features/orgs/projects/common/layout/AreaSidebarLayout';
import { BackupsPageLayout } from '@/features/orgs/projects/database/backups/components/BackupsPageLayout';
import { BackupsSidebar } from '@/features/orgs/projects/database/backups/components/BackupsSidebar';
import { PointInTimeBackupsContent } from '@/features/orgs/projects/database/backups/components/PointInTimeBackupsContent';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';

export default function PointInTimeBackupsPage() {
  return (
    <BackupsPageLayout>
      <PointInTimeBackupsContent />
    </BackupsPageLayout>
  );
}

PointInTimeBackupsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <AreaSidebarLayout sidebar={<BackupsSidebar />}>
            {page}
          </AreaSidebarLayout>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
