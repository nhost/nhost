import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { ApplicationLive } from '@/features/orgs/projects/common/components/ApplicationLive';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function AppIndexPage() {
  const { project, error } = useProject();
  if (error) {
    throw error;
  }

  if (!project) {
    return null;
  }

  return <ApplicationLive />;
}

AppIndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectViewWithState>{page}</ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
