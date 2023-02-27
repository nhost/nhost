import { useUserDataContext } from '@/context/workspace1-context';
import type { Project } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import type { Workspace } from '@/types/workspace';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import useIsPlatform from './common/useIsPlatform';

export interface UseCurrentWorkspaceAndApplicationReturnType {
  currentWorkspace: Workspace | null;
  currentApplication: Project | null;
}

export function useCurrentWorkspaceAndApplication(): UseCurrentWorkspaceAndApplicationReturnType {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { workspaceSlug, appSlug } = router.query;
  const { userContext } = useUserDataContext();
  const [currentWorkspaceAndApplication, setCurrentWorkspaceAndApplication] =
    useState<{
      currentWorkspace: Workspace | null;
      currentApplication: Project | null;
    }>({
      currentWorkspace: null,
      currentApplication: null,
    });

  useEffect(() => {
    if (!isPlatform) {
      const localApplication: Project = {
        id: 'local',
        slug: 'local',
        name: 'local',
        appStates: [
          {
            id: 'local',
            appId: 'local',
            stateId: ApplicationStatus.Live,
            createdAt: new Date().toISOString(),
          },
        ],
        deployments: [],
        subdomain: 'localhost',
        region: {
          id: null,
          countryCode: null,
          city: null,
          awsName: null,
        },
        isProvisioned: true,
        createdAt: new Date().toISOString(),
        desiredState: ApplicationStatus.Live,
        featureFlags: [],
        providersUpdated: true,
        repositoryProductionBranch: null,
        nhostBaseFolder: null,
        plan: null,
      };

      setCurrentWorkspaceAndApplication({
        currentWorkspace: {
          id: 'local',
          slug: 'local',
          name: 'local',
          applications: [localApplication],
          members: [],
        },
        currentApplication: localApplication,
      });

      return;
    }

    if (
      !userContext ||
      userContext.workspaces.length === 0 ||
      !router.isReady
    ) {
      return;
    }

    const currentWorkspace = userContext.workspaces.filter(
      (x) => x.slug === workspaceSlug,
    )[0];

    let currentApplication: Project;
    if (!appSlug || !currentWorkspace || !currentWorkspace.applications) {
      currentApplication = undefined;
    } else {
      const [firstApplication] = currentWorkspace.applications.filter(
        (x) => x.slug === appSlug,
      );

      currentApplication = firstApplication;
    }

    setCurrentWorkspaceAndApplication({
      currentWorkspace,
      currentApplication,
    });
  }, [userContext, router.isReady, workspaceSlug, appSlug, isPlatform]);

  if (isPlatform && userContext && userContext.workspaces.length > 0) {
    const currentWorkspace = userContext.workspaces.filter(
      (x) => x.slug === workspaceSlug,
    )[0];
    let currentApplication: Project;
    if (!appSlug || !currentWorkspace || !currentWorkspace.applications) {
      currentApplication = undefined;
    } else {
      const [firstApplication] = currentWorkspace.applications.filter(
        (x) => x.slug === appSlug,
      );

      currentApplication = firstApplication;
    }

    return {
      currentWorkspace,
      currentApplication,
    };
  }

  return { ...currentWorkspaceAndApplication };
}

export default useCurrentWorkspaceAndApplication;
