import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { EventsArea } from '@/features/orgs/projects/events/layout';
import SqlJobs from '@/features/orgs/projects/events/sql-jobs/components/SqlJobs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CronJobsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }
  return <SqlJobs />;
}

CronJobsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <EventsArea>{page}</EventsArea>
      </ProjectScope>
    </AppLayout>
  );
};
