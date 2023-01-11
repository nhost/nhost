import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Redirects to 404 page if either currentWorkspace/currentApplication resolves to undefined.
 */
export default function useNotFoundRedirect() {
  const { currentApplication, currentWorkspace } =
    useCurrentWorkspaceAndApplication();
  const router = useRouter();
  const {
    query: { workspaceSlug, appSlug, updating },
  } = useRouter();

  const notIn404Already = router.pathname !== '/404';
  const noResolvedWorkspace = workspaceSlug && currentWorkspace === undefined;
  const noResolvedApplication =
    workspaceSlug && appSlug && currentApplication === undefined;

  const isProjectUsingRDS = currentApplication?.featureFlags?.find(
    (feature) => feature.name === 'fleetcontrol_use_rds',
  );

  const inSettingsDatabasePage = router.pathname.includes('/settings/database');

  useEffect(() => {
    // This code is checking if the URL has a query of the form `?updating=true`
    // If it does (`updating` is true) this useEffect will immediately exit without executing
    //  any further statements (e.g. the page will show a loader until `updating` is false).
    // This is to prevent the user from being redirected to the 404 page while we are updating
    // either the workspace slug or application slug.
    if (updating) {
      return;
    }

    if (noResolvedWorkspace && notIn404Already) {
      router.push('/404');
    }

    if (noResolvedApplication && notIn404Already) {
      router.push('/404');
    }

    if (isProjectUsingRDS && inSettingsDatabasePage) {
      router.push('/404');
    }
  }, [
    updating,
    currentApplication,
    currentWorkspace,
    noResolvedApplication,
    noResolvedWorkspace,
    notIn404Already,
    router,
    isProjectUsingRDS,
    inSettingsDatabasePage,
  ]);
}
