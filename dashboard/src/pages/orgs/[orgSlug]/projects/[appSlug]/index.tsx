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
  const { project, error } = useProject();
  const { state } = useAppState();

  if (error) {
    throw error;
  }

  if (!project) {
    return null;
  }

  if (!isPlatform) {
    return <ApplicationLive />;
  }

  switch (state) {
    case ApplicationStatus.Empty:
      return <ApplicationProvisioning />;
    case ApplicationStatus.Provisioning:
      return <ApplicationProvisioning />;
    case ApplicationStatus.Updating:
      return <ApplicationLive />;
    case ApplicationStatus.Live:
      return <ApplicationLive />;
    case ApplicationStatus.Errored:
      return <ApplicationErrored />;
    case ApplicationStatus.Pausing:
    case ApplicationStatus.Paused:
      return <ApplicationPaused />;
    case ApplicationStatus.Unpausing:
      return <ApplicationUnpausing />;
    case ApplicationStatus.Restoring:
      return <ApplicationRestoring />;
    case ApplicationStatus.Migrating:
      return <ApplicationLive />;
    default:
      return <ApplicationUnknown />;
  }
}

AppIndexPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
