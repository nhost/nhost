import { useWorkspaceContext } from '@/context/workspace-context';
import { useUserDataContext } from '@/context/workspace1-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

export const useSetAppWorkspaceContextFromUserContext = () => {
  const {
    query: { appSlug },
  } = useRouter();

  const { workspaceContext, setWorkspaceContext } = useWorkspaceContext();
  const { userContext } = useUserDataContext();

  const { currentApplication } = useCurrentWorkspaceAndApplication();

  useEffect(() => {
    if (!userContext) {
      return;
    }

    if (userContext.workspaces.length === 0) {
      return;
    }

    if (!currentApplication) {
      return;
    }

    setWorkspaceContext({
      id: workspaceContext.id,
      name: workspaceContext.name,
      slug: workspaceContext.slug,
      app: currentApplication.name,
      appId: currentApplication.id,
      appSlug: currentApplication.slug,
      appName: currentApplication.name,
      appSubdomain: currentApplication.subdomain,
      appIsProvisioned: currentApplication.isProvisioned,
      appAdminSecret:
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? 'nhost-admin-secret'
          : currentApplication.config?.hasura.adminSecret,
      repository: currentApplication.githubRepository,
      provisioning:
        workspaceContext.provisioning || !currentApplication.isProvisioned,
    });
  }, [
    setWorkspaceContext,
    appSlug,
    currentApplication,
    userContext,
    workspaceContext.id,
    workspaceContext.name,
    workspaceContext.slug,
    workspaceContext.provisioning,
  ]);
};

export default useSetAppWorkspaceContextFromUserContext;
