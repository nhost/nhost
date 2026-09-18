import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { type PropsWithChildren, useEffect } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { getConfigServerUrl, isPlatform as isPlatformFn } from '@/utils/env';

const platFormOnlyPages = [
  '/orgs/[orgSlug]/projects/[appSubdomain]/deployments',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups/point-in-time',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups/import',
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

/**
 * Renders its children once the current project exists and is loaded. Whether
 * the project is *running* is a separate question, answered by
 * `ProjectViewWithState` below whatever chrome must stay visible while paused.
 */
export default function ProjectGuard({ children }: PropsWithChildren) {
  const { route, push } = useRouter();
  const isPlatform = useIsPlatform();

  const { project, loading, error, projectNotFound } = useProject();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

  useEffect(() => {
    if (
      isPlatformOnlyPage(route) ||
      isSelfHostedAndGraphitePage(route) ||
      (!error && isUserLoggedIn && projectNotFound)
    ) {
      push('/404');
    }
  }, [route, push, projectNotFound, isUserLoggedIn, error]);

  if (
    isPlatformOnlyPage(route) ||
    isSelfHostedAndGraphitePage(route) ||
    (!error && isUserLoggedIn && projectNotFound)
  ) {
    return null;
  }

  if (!loading && isNotEmptyValue(error)) {
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

  if (loading) {
    return <LoadingScreen data-testid="projectLoadingIndicator" />;
  }

  return (
    <>
      {children}
      <NextSeo title={!isPlatform ? 'Local App' : project?.name} />
    </>
  );
}
