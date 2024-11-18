import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v3/button';
import { ApplicationPaused } from '@/features/orgs/projects/common/components/ApplicationPaused';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/orgs/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/orgs/projects/common/components/ApplicationUnpausing';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { ApplicationStatus } from '@/types/application';
import { useUnpauseApplicationMutation } from '@/utils/__generated__/graphql';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProjectLayoutProps extends AuthenticatedLayoutProps {
  /**
   * Props passed to the internal `<main />` element.
   */
  mainContainerProps?: BoxProps;
}

function ProjectLayoutContent({
  children,
  mainContainerProps = {},
}: ProjectLayoutProps) {
  const {
    route,
    query: { appSubdomain },
  } = useRouter();

  const { state } = useAppState();
  const isPlatform = useIsPlatform();
  const [unpauseApplication, { loading: changingApplicationStateLoading }] =
    useUnpauseApplicationMutation({});
  const {
    project,
    loading,
    error,
    refetch: refetchProject,
  } = useProject({ poll: true });

  const { currentOrg: org } = useOrgs();

  const { freeAndLiveProjectsNumberExceeded } = useAppPausedReason();

  async function handleTriggerUnpausing() {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project.id } });
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage:
          'An error occurred while waking up the project. Please try again.',
      },
    );
  }

  const isOnOverviewPage = route === '/orgs/[orgSlug]/projects/[appSubdomain]';

  const renderPausedProjectContent = useCallback(
    (_children: ReactNode) => {
      const baseProjectPageRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/';
      const blockedPausedProjectPages = [
        'database',
        'database/browser/[dataSourceSlug]',
        'graphql',
        'hasura',
        'users',
        'storage',
        'ai/auto-embeddings',
        'ai/assistants',
        'metrics',
      ].map((page) => baseProjectPageRoute.concat(page));

      // show an alert box on top of the overview page with a wake up button
      if (isOnOverviewPage) {
        return (
          <>
            <div className="mx-auto mt-5 flex max-w-7xl p-4 pb-0">
              <div className="flex w-full flex-col items-center justify-between gap-2 rounded-lg bg-[#f4f7f9] px-5 py-4 dark:bg-[#21262d] md:flex-row">
                {org?.plan?.isFree ? (
                  <p>
                    Projects under your Personal Organization will stop
                    responding to API calls after 7 days of inactivity, so
                    consider transferring the project to a{' '}
                    <b>Pro Organization</b> to avoid auto-sleep.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    <p>
                      Project <span className="font-bold">{project?.name}</span>{' '}
                      is paused.
                    </p>
                    <p>
                      Wake up your project to make it accessible again. Once
                      reactivated, all features will be fully functional.
                    </p>
                  </div>
                )}
                {freeAndLiveProjectsNumberExceeded && (
                  <p className="text-center">
                    Additionally, only 1 free project can be active at any given
                    time, so please pause your current active free project
                    before unpausing another.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full md:w-fit"
                  disabled={changingApplicationStateLoading}
                  onClick={handleTriggerUnpausing}
                >
                  {changingApplicationStateLoading ? (
                    <ActivityIndicator />
                  ) : (
                    'Wake up'
                  )}
                </Button>
              </div>
            </div>
            {children}
          </>
        );
      }

      // block these pages when the project is paused
      if (blockedPausedProjectPages.includes(route)) {
        return <ApplicationPaused />;
      }

      return _children;
    },
    [route, isOnOverviewPage],
  );

  // Render application state based on the current state
  const projectPageContent = useMemo(() => {
    if (!appSubdomain || state === undefined) {
      return children;
    }

    switch (state) {
      case ApplicationStatus.Empty:
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
        return renderPausedProjectContent(children);
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
  }, [
    state,
    children,
    appSubdomain,
    isOnOverviewPage,
    renderPausedProjectContent,
  ]);

  // Handle loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Handle error state
  if (error) {
    throw error;
  }

  return (
    <Box
      component="main"
      className={twMerge(
        'relative h-full flex-auto overflow-y-auto',
        mainContainerProps.className,
      )}
      {...mainContainerProps}
    >
      {projectPageContent}
      <NextSeo title={!isPlatform ? 'Local App' : project?.name} />
    </Box>
  );
}

export default function ProjectLayout({
  children,
  mainContainerProps,
  ...props
}: ProjectLayoutProps) {
  return (
    <AuthenticatedLayout {...props}>
      <ProjectLayoutContent mainContainerProps={mainContainerProps}>
        {children}
      </ProjectLayoutContent>
    </AuthenticatedLayout>
  );
}
