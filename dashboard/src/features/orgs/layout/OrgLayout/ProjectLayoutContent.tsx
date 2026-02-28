import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';
import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { getConfigServerUrl, isPlatform as isPlatformFn } from '@/utils/env';
import ProjectViewWithState from './ProjectViewWithState';

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
  const { route, push } = useRouter();

  const isPlatform = useIsPlatform();

  const { project, loading, error, projectNotFound } = useProject();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

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

  if (loading) {
    return <LoadingScreen data-testid="projectLoadingIndicator" />;
  }

  if (isNotEmptyValue(error)) {
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
      <ProjectViewWithState>{children}</ProjectViewWithState>
      <NextSeo title={!isPlatform ? 'Local App' : project?.name} />
    </Box>
  );
}

export default ProjectLayoutContent;
