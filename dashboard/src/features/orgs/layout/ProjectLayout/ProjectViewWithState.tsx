import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { type PropsWithChildren, useEffect, useMemo } from 'react';
import { Alert } from '@/components/ui/v3/alert';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { usePollWhileTransitioning } from '@/features/orgs/projects/common/hooks/usePollWhileTransitioning';
import { OverviewPausedState } from '@/features/orgs/projects/overview/components/OverviewPausedState';
import { isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

function ProjectViewWithState({ children }: PropsWithChildren) {
  const {
    query: { appSubdomain },
    route,
  } = useRouter();

  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, [queryClient]);

  const { state } = useAppState();

  usePollWhileTransitioning();

  const isOnOverviewPage = route === '/orgs/[orgSlug]/projects/[appSubdomain]';

  const projectPageContent = useMemo(() => {
    if (!appSubdomain || state === undefined) {
      return children;
    }

    switch (state) {
      case ApplicationStatus.Empty: {
        if (typeof window !== 'undefined') {
          const newProjectSubdomain = sessionStorage.getItem(
            'newProjectSubdomain',
          );
          if (
            isNotEmptyValue(newProjectSubdomain) &&
            newProjectSubdomain === appSubdomain
          ) {
            return <ApplicationProvisioning />;
          }
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
        // Overview has no section tab bar of its own, so it's the only place
        // this component still swaps the whole page. Every other section
        // keeps its own tab bar/sidebar visible and gates just its content
        // (see ProjectSectionContent), so this leaves the section render its
        // own children here.
        if (isOnOverviewPage) {
          return <OverviewPausedState state={state} />;
        }
        return children;
      case ApplicationStatus.Live:
      case ApplicationStatus.Updating:
      case ApplicationStatus.Migrating:
        return children;
      default:
        return <ApplicationUnknown />;
    }
  }, [state, children, appSubdomain, isOnOverviewPage]);

  return projectPageContent;
}

export default ProjectViewWithState;
