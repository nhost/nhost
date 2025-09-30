import { type AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Alert } from '@/components/ui/v2/Alert';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { ApplicationPaused } from '@/features/orgs/projects/common/components/ApplicationPaused';
import { ApplicationPausedBanner } from '@/features/orgs/projects/common/components/ApplicationPausedBanner';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/orgs/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/orgs/projects/common/components/ApplicationUnpausing';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProjectWithState } from '@/features/orgs/projects/hooks/useProjectWithState';
import { isEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { ApplicationStatus } from '@/types/application';
import { getConfigServerUrl, isPlatform as isPlatformFn } from '@/utils/env';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

const platFormOnlyPages = [
  '/orgs/[orgSlug]/projects/[appSubdomain]/deployments',
  '/orgs/[orgSlug]/projects/[appSubdomain]/backups',
  '/orgs/[orgSlug]/projects/[appSubdomain]/logs',
  '/orgs/[orgSlug]/projects/[appSubdomain]/metrics',
  '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]',
];

function isSelfHostedAndGraphitePage(route: string) {
  const isGraphitePage = route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/ai',
  );
  const isConfigEnvVariableNotSet = getConfigServerUrl() === '';

  return isGraphitePage && isConfigEnvVariableNotSet;
}

function isPlatformOnlyPage(route: string) {
  const platFormOnlyPage = !!platFormOnlyPages.find((page) => route === page);
  const isNotPlatform = !isPlatformFn();

  return isNotPlatform && platFormOnlyPage;
}

export interface ProjectLayoutContentProps extends AuthenticatedLayoutProps {
  /**
   * Props passed to the internal `<main />` element.
   */
  mainContainerProps?: BoxProps;
}

function ProjectLayoutContent({
  children,
  mainContainerProps = {},
}: ProjectLayoutContentProps) {
  const {
    route,
    query: { appSubdomain },
    push,
  } = useRouter();

  const { state } = useAppState();
  const isPlatform = useIsPlatform();

  const { project, loading, error, projectNotFound } = useProjectWithState();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

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
              <ApplicationPausedBanner
                alertClassName="flex-row"
                textContainerClassName="flex flex-col items-center justify-center text-left"
                wakeUpButtonClassName="w-fit self-center"
              />
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
    [route, isOnOverviewPage, children],
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

  useEffect(() => {
    if (
      isPlatformOnlyPage(route) ||
      isSelfHostedAndGraphitePage(route) ||
      (isUserLoggedIn && projectNotFound)
    ) {
      push('/404');
    }
  }, [route, push, projectNotFound, isUserLoggedIn]);

  if (
    isPlatformOnlyPage(route) ||
    isSelfHostedAndGraphitePage(route) ||
    (isUserLoggedIn && projectNotFound)
  ) {
    return null;
  }

  // Handle loading state
  if (loading) {
    return <LoadingScreen data-testid="projectLoadingIndicator" />;
  }

  // Handle error state
  if (error) {
    throw error;
  }

  if (
    isUserLoggedIn &&
    isEmptyValue(project) &&
    !loading &&
    isEmptyValue(error)
  ) {
    throw new Error('Could not load project. Please try again later.');
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

export default ProjectLayoutContent;
