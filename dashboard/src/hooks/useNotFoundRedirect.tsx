import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Redirects to 404 page if either currentWorkspace/currentProject resolves to undefined.
 */
export default function useNotFoundRedirect() {
  const router = useRouter();
  const {
    query: { workspaceSlug, appSlug, updating },
    isReady,
  } = router;

  const { currentProject, currentWorkspace, loading } =
    useCurrentWorkspaceAndProject();

  useEffect(() => {
    if (
      updating ||
      !isReady ||
      loading ||
      router.pathname === '/404' ||
      (workspaceSlug && currentWorkspace && appSlug && currentProject) ||
      (workspaceSlug && currentWorkspace)
    ) {
      return;
    }

    router.replace('/404');
  }, [
    currentProject,
    currentWorkspace,
    isReady,
    loading,
    appSlug,
    router,
    updating,
    workspaceSlug,
  ]);
}
