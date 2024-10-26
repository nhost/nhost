import { useRouter } from 'next/router';
import { useMemo } from 'react';

type TreeState = {
  expandedItems: string[];
  focusedItem: string | null;
};

const useNavTreeStateFromURL = (): TreeState => {
  const router = useRouter();

  // Extract orgSlug and appSubdomain from router.query
  const { orgSlug, appSubdomain } = router.query as {
    orgSlug?: string;
    appSubdomain?: string;
  };

  // Extract path segments from the URL
  const pathSegments = useMemo(() => router.asPath.split('/'), [router.asPath]);

  // Identify project and settings pages based on the URL pattern
  const orgPage = pathSegments[3] || null;
  const projectPage = pathSegments[5] || null;
  const newProject = pathSegments[4] === 'new';

  const isSettingsPage = pathSegments.includes('settings');
  const settingsPage = isSettingsPage ? pathSegments[6] || null : null;

  return useMemo(() => {
    if (!orgSlug) {
      // If no orgSlug, return an empty state
      return { expandedItems: ['organizations'], focusedItem: null };
    }

    const expandedItems: string[] = [];
    let focusedItem: string | null = null;

    // Expand organization-level items
    expandedItems.push('organizations', orgSlug);

    if (!appSubdomain) {
      if (newProject) {
        expandedItems.push(`${orgSlug}-projects`);
        focusedItem = `${orgSlug}-new-project`;
      } else if (orgPage) {
        focusedItem = `${orgSlug}-${orgPage}`;
      }
      return { expandedItems, focusedItem };
    }

    // Expand project-level items
    expandedItems.push(`${orgSlug}-projects`, `${orgSlug}-${appSubdomain}`);

    if (!projectPage) {
      // overview page is the default when hitting /orgs/[orgSlug]/projects/[projectSlug]
      focusedItem = `${orgSlug}-${appSubdomain}-overview`;
    } else {
      focusedItem = `${orgSlug}-${appSubdomain}-${projectPage}`;
    }

    if (isSettingsPage) {
      expandedItems.push(`${orgSlug}-${appSubdomain}-settings`);
      if (!settingsPage) {
        focusedItem = `${orgSlug}-${appSubdomain}-settings-general`;
      } else {
        focusedItem = `${orgSlug}-${appSubdomain}-settings-${settingsPage}`;
      }
    }

    return { expandedItems, focusedItem };
  }, [
    orgSlug,
    appSubdomain,
    orgPage,
    projectPage,
    settingsPage,
    isSettingsPage,
    newProject,
  ]);
};

export default useNavTreeStateFromURL;
