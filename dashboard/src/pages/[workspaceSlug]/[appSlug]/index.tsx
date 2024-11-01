import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { ApplicationLive } from '@/features/projects/common/components/ApplicationLive';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { ReactElement } from 'react';

export default function AppIndexPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  if (!currentProject) {
    return null;
  }

  return <ApplicationLive />;
}

AppIndexPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
