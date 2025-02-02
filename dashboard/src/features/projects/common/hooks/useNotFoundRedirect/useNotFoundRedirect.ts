import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Redirects to 404 page if either currentWorkspace/currentProject resolves to undefined
 * or if the current pathname is not a valid organization/project.
 * Not applicable if running dashboard with local Nhost backend.
 */
export default function useNotFoundRedirect() {
  const router = useRouter();
  const {
    query: {
      orgSlug: urlOrgSlug,
      workspaceSlug: urlWorkspaceSlug,
      appSubdomain: urlAppSubdomain,
      updating,
      appSlug: urlAppSlug,
    },
    isReady,
  } = router;

  const { project, loading: projectLoading } = useProject();
  const isPlatform = useIsPlatform();
  const { org, loading: orgLoading } = useCurrentOrg();

  const { subdomain: projectSubdomain } = project || {};
  const { slug: currentOrgSlug } = org || {};

  const { currentProject, currentWorkspace, loading } =
    useCurrentWorkspaceAndProject();

  useEffect(() => {
    if (
      // If we're updating, we don't want to redirect to 404
      updating ||
      // If the router is not ready, we don't want to redirect to 404
      !isReady ||
      // If the current workspace and project are not loaded, we don't want to redirect to 404
      loading ||
      // If the project is loading, we don't want to redirect to 404
      projectLoading ||
      // If the org is loading, we don't want to redirect to 404
      orgLoading ||
      // If we're already on the 404 page, we don't want to redirect to 404
      router.pathname === '/404' ||
      router.pathname === '/' ||
      router.pathname === '/account' ||
      router.pathname === '/support/ticket' ||
      router.pathname === '/run-one-click-install' ||
      router.pathname.includes('/orgs/_') ||
      router.pathname.includes('/orgs/_/projects/_') ||
      (!isPlatform && router.pathname.includes('/orgs/local')) ||
      (!isPlatform && router.pathname.includes('/orgs/[orgSlug]/projects')) ||
      // If we are on a valid org and project, we don't want to redirect to 404
      (urlOrgSlug && currentOrgSlug && urlAppSubdomain && projectSubdomain) ||
      // If we are on a valid org and no project is selected, we don't want to redirect to 404
      (urlOrgSlug && currentOrgSlug && !urlAppSubdomain && !projectSubdomain) ||
      // If we are on a valid workspace and project, we don't want to redirect to 404
      (urlWorkspaceSlug && currentWorkspace && urlAppSlug && currentProject) ||
      // If we are on a valid workspace and no project is selected, we don't want to redirect to 404
      (urlWorkspaceSlug && currentWorkspace && !urlAppSlug && !currentProject)
    ) {
      return;
    }

    router.replace('/404');
  }, [
    currentProject,
    currentWorkspace,
    isReady,
    loading,
    urlAppSubdomain,
    urlAppSlug,
    router,
    updating,
    projectLoading,
    orgLoading,
    currentOrgSlug,
    projectSubdomain,
    urlWorkspaceSlug,
    urlOrgSlug,
    isPlatform,
  ]);
}
