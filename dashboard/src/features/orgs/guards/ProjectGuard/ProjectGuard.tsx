import {
  useMatchRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { type PropsWithChildren, useEffect } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { getConfigServerUrl, isPlatform as isPlatformFn } from '@/utils/env';

// Route IDs of the pages themselves (index routes end in `/`), compared
// exactly: the deployments and metrics settings pages below them stay
// available off-platform.
const platformOnlyPages: ReadonlySet<string> = new Set([
  '/orgs/$orgSlug/projects/$appSubdomain/deployments/',
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups/',
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups/point-in-time',
  '/orgs/$orgSlug/projects/$appSubdomain/database/backups/import',
  '/orgs/$orgSlug/projects/$appSubdomain/metrics/',
  '/orgs/$orgSlug/projects/$appSubdomain/deployments/$deploymentId',
]);

/**
 * Pages that can't be shown for this project: platform-only pages on a local
 * dashboard, and the AI pages when there is no config server.
 */
function useIsUnavailablePage() {
  const matchRoute = useMatchRoute();
  const currentRouteId = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId,
  });

  const isPlatformOnlyPage =
    !isPlatformFn() &&
    currentRouteId !== undefined &&
    platformOnlyPages.has(currentRouteId);
  const isSelfHostedAndGraphitePage =
    getConfigServerUrl() === '' &&
    matchRoute({
      to: '/orgs/$orgSlug/projects/$appSubdomain/ai',
      fuzzy: true,
    }) !== false;

  return isPlatformOnlyPage || isSelfHostedAndGraphitePage;
}

/**
 * Renders its children once the current project exists and is loaded. Whether
 * the project is *running* is a separate question, answered by
 * `ProjectStateGate` below whatever chrome must stay visible while paused.
 */
export default function ProjectGuard({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const isUnavailablePage = useIsUnavailablePage();
  const isPlatform = useIsPlatform();

  const { project, loading, error, projectNotFound } = useProject();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

  useEffect(() => {
    if (isUnavailablePage || (!error && isUserLoggedIn && projectNotFound)) {
      navigate({ to: '/404' });
    }
  }, [isUnavailablePage, navigate, projectNotFound, isUserLoggedIn, error]);

  if (isUnavailablePage || (!error && isUserLoggedIn && projectNotFound)) {
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

  const pageTitle = isPlatform ? project?.name : 'Local App';

  return (
    <>
      {children}
      {pageTitle ? <PageTitle title={pageTitle} /> : null}
    </>
  );
}
