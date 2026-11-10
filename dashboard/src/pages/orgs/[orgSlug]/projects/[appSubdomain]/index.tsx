import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
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
        <ProjectStateGate>{page}</ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
