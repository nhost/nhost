import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { useProject } from '@/features/orgs/hooks/useProject';
import { ApplicationErrored } from '@/features/projects/common/components/ApplicationErrored';
import { ApplicationLive } from '@/features/projects/common/components/ApplicationLive';
import { ApplicationPaused } from '@/features/projects/common/components/ApplicationPaused';
import { ApplicationProvisioning } from '@/features/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/projects/common/components/ApplicationUnpausing';
import { useAppState } from '@/features/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ApplicationStatus } from '@/types/application';
import type { ReactElement } from 'react';

export default function AppIndexPage() {
  const isPlatform = useIsPlatform();
  const { project, error } = useProject({ poll: true });
  const { state } = useAppState();

  if (error) {
    throw error;
  }

  if (!project) {
    return null;
  }

  return (
    <span>Overview</span>
  )
}

AppIndexPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};