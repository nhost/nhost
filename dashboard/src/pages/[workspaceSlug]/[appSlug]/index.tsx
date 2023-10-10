import DepricationNotice from '@/components/common/DepricationNotice/DepricationNotice';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { ApplicationErrored } from '@/features/projects/common/components/ApplicationErrored';
import { ApplicationLive } from '@/features/projects/common/components/ApplicationLive';
import { ApplicationPaused } from '@/features/projects/common/components/ApplicationPaused';
import { ApplicationProvisioning } from '@/features/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/projects/common/components/ApplicationUnpausing';
import { useAppState } from '@/features/projects/common/hooks/useAppState';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ApplicationStatus } from '@/types/application';
import type { ReactElement } from 'react';

export default function AppIndexPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const { state } = useAppState();

  if (!currentProject) {
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
    default:
      return <ApplicationUnknown />;
  }
}

AppIndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout>
      <DepricationNotice />
      {page}
    </ProjectLayout>
  );
};
