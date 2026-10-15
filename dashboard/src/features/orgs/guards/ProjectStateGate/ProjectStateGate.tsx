import { useParams } from '@tanstack/react-router';
import { type PropsWithChildren, useMemo } from 'react';
import { Alert } from '@/components/ui/v3/alert';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { usePollWhileTransitioning } from '@/features/orgs/projects/common/hooks/usePollWhileTransitioning';
import { useCurrentPagePath } from '@/lib/route-navigation';
import { isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import ProjectStateScreen from './ProjectStateScreen';
import { requiresRunningProject } from './projectStatePages';

function ProjectStateGate({ children }: PropsWithChildren) {
  const { appSubdomain } = useParams({ strict: false });
  const pagePath = useCurrentPagePath();

  const { state } = useAppState();

  usePollWhileTransitioning();

  const isOnOverviewPage =
    pagePath === '/orgs/$orgSlug/projects/$appSubdomain/';

  const projectPageContent = useMemo(() => {
    if (!appSubdomain || state === undefined) {
      return children;
    }

    switch (state) {
      case ApplicationStatus.Empty: {
        const newProjectSubdomain = sessionStorage.getItem(
          'newProjectSubdomain',
        );
        if (
          isNotEmptyValue(newProjectSubdomain) &&
          newProjectSubdomain === appSubdomain
        ) {
          return <ApplicationProvisioning />;
        }

        return null;
      }
      case ApplicationStatus.Provisioning: {
        sessionStorage.removeItem('newProjectSubdomain');
        return <ApplicationProvisioning />;
      }
      case ApplicationStatus.Errored:
        if (isOnOverviewPage) {
          return (
            <>
              <div className="w-full p-4">
                <Alert variant="destructive" className="mx-auto max-w-7xl">
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
      case ApplicationStatus.Unpausing:
      case ApplicationStatus.Restoring:
        return requiresRunningProject(pagePath) ? (
          <ProjectStateScreen />
        ) : (
          children
        );
      case ApplicationStatus.Live:
      case ApplicationStatus.Updating:
      case ApplicationStatus.Migrating:
        return children;
      default:
        return <ApplicationUnknown />;
    }
  }, [state, children, appSubdomain, isOnOverviewPage, pagePath]);

  return projectPageContent;
}

export default ProjectStateGate;
