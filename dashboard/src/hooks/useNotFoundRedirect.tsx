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
    query: { workspaceSlug, appSlug, mutating },
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
    if (mutating) {
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
    mutating,
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
