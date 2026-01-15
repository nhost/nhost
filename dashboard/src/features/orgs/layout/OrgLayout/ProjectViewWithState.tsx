import { useRouter } from 'next/router';
import { type PropsWithChildren, useMemo } from 'react';
import { Alert } from '@/components/ui/v2/Alert';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/orgs/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/orgs/projects/common/components/ApplicationUnpausing';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

import PausedProjectContent from './PausedProjectContent';

function ProjectViewWithState({ children }: PropsWithChildren) {
  const {
    query: { appSubdomain },
    route,
  } = useRouter();

  const { state } = useAppState();

  const isOnOverviewPage = route === '/orgs/[orgSlug]/projects/[appSubdomain]';

  const projectPageContent = useMemo(() => {
    if (!appSubdomain || state === undefined) {
      return children;
    }

    switch (state) {
      case ApplicationStatus.Empty:
        return null;
      case ApplicationStatus.Provisioning:
        return <ApplicationProvisioning />;
      case ApplicationStatus.Errored:
        if (isOnOverviewPage) {
          return (
            <>
              <div className="w-full p-4">
                <Alert severity="error" className="mx-auto max-w-7xl">
                  Error deploying the project most likely due to invalid
                  configuration. Please review your project&apos;s configuration
                  and logs for more information.
                </Alert>
              </div>
              {children}
            </>
          );
        }
        return children;
      case ApplicationStatus.Pausing:
      case ApplicationStatus.Paused:
        return <PausedProjectContent>{children}</PausedProjectContent>;
      case ApplicationStatus.Unpausing:
        return <ApplicationUnpausing />;
      case ApplicationStatus.Restoring:
        return <ApplicationRestoring />;
      case ApplicationStatus.Updating:
      case ApplicationStatus.Live:
      case ApplicationStatus.Migrating:
        return children;
      default:
        return <ApplicationUnknown />;
    }
  }, [state, children, appSubdomain, isOnOverviewPage]);

  return projectPageContent;
}

export default ProjectViewWithState;
