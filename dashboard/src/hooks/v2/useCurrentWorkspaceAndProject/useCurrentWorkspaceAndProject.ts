import useIsPlatform from '@/hooks/common/useIsPlatform';
import type { Project, Workspace } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import { GetWorkspaceAndProjectDocument } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import { useNhostClient, useUserData } from '@nhost/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';

export interface UseCurrentWorkspaceAndProjectReturnType {
  /**
   * The current workspace.
   */
  currentWorkspace: Workspace;
  /**
   * The current project.
   */
  currentProject: Project;
  /**
   * Whether the query is loading.
   */
  loading?: boolean;
  /**
   * The error if any.
   */
  error?: Error;
}

export default function useCurrentWorkspaceAndProject(): UseCurrentWorkspaceAndProjectReturnType {
  const client = useNhostClient();
  const user = useUserData();
  const isPlatform = useIsPlatform();

  const {
    query: { workspaceSlug, appSlug },
    isReady,
  } = useRouter();

  // We can't use the hook exported by the codegen here because there are cases
  // where it doesn't target the Nhost backend, but the currently active project
  // instead.
  const { data: response, status } = useQuery(
    ['currentWorkspaceAndProject', workspaceSlug, appSlug],
    () =>
      client.graphql.request<{ workspaces: Workspace[]; projects?: Project[] }>(
        GetWorkspaceAndProjectDocument,
        {
          workspaceSlug: (workspaceSlug as string) || '',
          projectSlug: (appSlug as string) || '',
        },
      ),
    {
      keepPreviousData: true,
      enabled: isPlatform && isReady && !!workspaceSlug && !!user,
      // multiple components are relying on this query, so we don't want to
      // refetch it too often - kind of a hack, should be improved later
      staleTime: 1000,
    },
  );

  // Return a default project if working locally
  if (!isPlatform) {
    const localProject: Project = {
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
      subdomain: 'local',
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
      config: {
        hasura: {
          adminSecret: getHasuraAdminSecret(),
        },
      },
    };

    return {
      currentWorkspace: {
        id: 'local',
        slug: 'local',
        name: 'local',
        projects: [localProject],
        workspaceMembers: [],
      },
      currentProject: localProject,
      loading: false,
    };
  }

  // Return the current workspace and project if using the Nhost backend
  const [currentWorkspace] = response?.data?.workspaces || [];
  const [currentProject] = response?.data?.projects || [];
  const error = Array.isArray(response?.error || {})
    ? response?.error[0]
    : response?.error;

  return {
    currentWorkspace,
    currentProject,
    loading: response ? false : status === 'loading',
    error: response?.error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
  };
}
