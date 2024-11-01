import { useRouter } from 'next/router';
import { useMemo } from 'react';

type TreeState = {
  expandedItems: string[];
  focusedItem: string | null;
};

const useWorkspacesNavTreeStateFromURL = (): TreeState => {
  const router = useRouter();

  const { workspaceSlug, appSlug } = router.query as {
    workspaceSlug?: string;
    appSlug?: string;
  };

  // Extract path segments from the URL
  const pathSegments = useMemo(() => router.asPath.split('/'), [router.asPath]);

  const projectPage = pathSegments[3] || null;
  const isSettingsPage = pathSegments.includes('settings');
  const settingsPage = isSettingsPage ? pathSegments[4] || null : null;

  return useMemo(() => {
    if (!workspaceSlug) {
      return { expandedItems: ['workspaces'], focusedItem: '-1' };
    }

    const expandedItems: string[] = [];
    let focusedItem: string | null = null;

    // Expand organization-level items
    expandedItems.push('workspaces', workspaceSlug);

    if (!appSlug) {
      focusedItem = `${workspaceSlug}-overview`;

      return { expandedItems, focusedItem };
    }

    // Expand project-level items
    expandedItems.push(
      `${workspaceSlug}-projects`,
      `${workspaceSlug}-${appSlug}`,
    );

    if (!projectPage) {
      focusedItem = `${workspaceSlug}-${appSlug}-overview`;
    } else {
      focusedItem = `${workspaceSlug}-${appSlug}-${projectPage}`;
    }

    if (isSettingsPage) {
      expandedItems.push(`${workspaceSlug}-${appSlug}-settings`);
      if (!settingsPage) {
        focusedItem = `${workspaceSlug}-${appSlug}-settings-general`;
      } else {
        focusedItem = `${workspaceSlug}-${appSlug}-settings-${settingsPage}`;
      }
    }

    return { expandedItems, focusedItem };
  }, [workspaceSlug, appSlug, projectPage, settingsPage, isSettingsPage]);
};

export default useWorkspacesNavTreeStateFromURL;
