import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { EventsArea } from '@/features/orgs/projects/events/layout';
import SqlJobs from '@/features/orgs/projects/events/sql-jobs/components/SqlJobs';

export default function SqlJobsPage() {
  return <SqlJobs />;
}

SqlJobsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <EventsArea>{page}</EventsArea>
      </ProjectScope>
    </AppLayout>
  );
};
