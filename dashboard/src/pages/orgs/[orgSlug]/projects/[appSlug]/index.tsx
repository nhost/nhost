import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { ApplicationErrored } from '@/features/orgs/projects/common/components/ApplicationErrored';
import { ApplicationLive } from '@/features/orgs/projects/common/components/ApplicationLive';
import { ApplicationPaused } from '@/features/orgs/projects/common/components/ApplicationPaused';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/orgs/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/orgs/projects/common/components/ApplicationUnpausing';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
