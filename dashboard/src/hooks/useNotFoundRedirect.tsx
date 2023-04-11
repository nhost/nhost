import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Redirects to 404 page if either currentWorkspace/currentProject resolves to undefined.
 */
export default function useNotFoundRedirect() {
  const { currentProject, currentWorkspace, loading } =
    useCurrentWorkspaceAndProject();
  const router = useRouter();
  const {
    query: { workspaceSlug, appSlug, updating },
    isReady,
  } = router;

  const notIn404Already = router.pathname !== '/404';
  const noResolvedWorkspace =
    isReady && !loading && workspaceSlug && currentWorkspace === undefined;
  const noResolvedApplication =
    isReady &&
    !loading &&
    workspaceSlug &&
    appSlug &&
    currentProject === undefined;

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
      router.replace('/404');
    }

    if (noResolvedApplication && notIn404Already) {
      router.replace('/404');
    }
  }, [
    isReady,
    updating,
    currentProject,
    currentWorkspace,
    noResolvedApplication,
    noResolvedWorkspace,
    notIn404Already,
    router,
    inSettingsDatabasePage,
  ]);
}
