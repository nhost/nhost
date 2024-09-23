import { useRouter } from 'next/router';
import { useMemo } from 'react';

type TreeState = {
  expandedItems: string[];
  focusedItem: string | null;
};

const useNavTreeStateFromURL = (): TreeState => {
  const router = useRouter();

  // Extract orgSlug and appSlug from router.query
  const { orgSlug, appSlug } = router.query as {
    orgSlug?: string;
    appSlug?: string;
  };

  // Extract path segments from the URL
  const pathSegments = useMemo(() => router.asPath.split('/'), [router.asPath]);

  // Identify project and settings pages based on the URL pattern
  const isSettingsPage = pathSegments.includes('settings');
  const projectPage = pathSegments[3] || null;
  const settingsPage = isSettingsPage ? pathSegments[4] || null : null;

  return useMemo(() => {
    if (!orgSlug) {
      // If no orgSlug, return an empty state
      return { expandedItems: [], focusedItem: null };
    }

    const expandedItems: string[] = [];
    let focusedItem: string | null = null;

    // Expand organization-level items
    expandedItems.push('organizations', orgSlug);

    if (!appSlug) {
      // Focus on organization-level URLs
      const orgPage = pathSegments[pathSegments.length - 1];
      if (orgPage) {
        focusedItem = `${orgSlug}-${orgPage}`;
      }
      return { expandedItems, focusedItem };
    }

    // Expand project-level items
    expandedItems.push(`${orgSlug}-projects`, `${orgSlug}-${appSlug}`);

    if (projectPage) {
      expandedItems.push(`${orgSlug}-${appSlug}-${projectPage}`);
    }

    if (isSettingsPage && settingsPage) {
      expandedItems.push(`${orgSlug}-${appSlug}-settings`);
      focusedItem = `${orgSlug}-${appSlug}-settings-${settingsPage}`;
    }

    return { expandedItems, focusedItem };
  }, [
    orgSlug,
    appSlug,
    projectPage,
    settingsPage,
    pathSegments,
    isSettingsPage,
  ]);
};

export default useNavTreeStateFromURL;
