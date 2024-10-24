import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { ApplicationLive } from '@/features/orgs/projects/common/components/ApplicationLive';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ReactElement } from 'react';

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
  return <ProjectLayout>{page}</ProjectLayout>;
};
