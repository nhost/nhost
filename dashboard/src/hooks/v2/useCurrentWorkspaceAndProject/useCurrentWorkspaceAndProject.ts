import useIsPlatform from '@/hooks/common/useIsPlatform';
import type { Project, Workspace } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import type { GetWorkspaceAndProjectQueryHookResult } from '@/utils/__generated__/graphql';
import { useGetWorkspaceAndProjectQuery } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import type { QueryHookOptions } from '@apollo/client';
import { useRouter } from 'next/router';

export interface UseCurrentWorkspaceAndProjectOptions {
  /**
   * The fetch policy to use.
   *
   * @default 'cache-first'
   */
  fetchPolicy?: QueryHookOptions['fetchPolicy'];
}

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
  loading?: GetWorkspaceAndProjectQueryHookResult['loading'];
  /**
   * The error if any.
   */
  error?: GetWorkspaceAndProjectQueryHookResult['error'];
}

export default function useCurrentWorkspaceAndProject(
  options?: UseCurrentWorkspaceAndProjectOptions,
): UseCurrentWorkspaceAndProjectReturnType {
  const isPlatform = useIsPlatform();

  const {
    query: { workspaceSlug, appSlug },
    isReady,
  } = useRouter();

  const { data, loading, error } = useGetWorkspaceAndProjectQuery({
    variables: {
      workspaceSlug: (workspaceSlug as string) || '',
      projectSlug: (appSlug as string) || '',
    },
    fetchPolicy: options?.fetchPolicy || 'cache-first',
    skip: !isPlatform || !isReady || !workspaceSlug,
  });

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

  const [currentWorkspace] = data?.workspaces || [];
  const [currentProject] = data?.projects || [];

  return {
    currentWorkspace,
    currentProject,
    loading: data ? false : loading,
    error,
  };
}
