import { localApplication } from '@/features/orgs/utils/local-dashboard';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetProjectDocument,
  useGetProjectQuery,
  type GetProjectQuery,
  type ProjectFragment,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus, useNhostClient } from '@nhost/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';

type Project = GetProjectQuery['apps'][0];

interface UseProjectOptions {
  poll?: boolean;
  target?: 'console-next' | 'user-project';
}

export interface UseProjectReturnType {
  project: Project;
  loading?: boolean;
  error?: Error;
  refetch: (variables?: any) => Promise<any>;
}

export default function useProject({
  poll = false,
  target = 'console-next',
}: UseProjectOptions = {}): UseProjectReturnType {
  const {
    query: { appSubdomain },
    isReady: isRouterReady,
  } = useRouter();
  const client = useNhostClient();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } =
    useAuthenticationStatus();

  const shouldFetchProject =
    isPlatform &&
    isAuthenticated &&
    !isAuthLoading &&
    !!appSubdomain &&
    isRouterReady;

  // Fetch project data for 'console-next' target
  const {
    data: consoleData,
    loading: consoleLoading,
    error: consoleError,
    refetch: refetchConsole,
  } = useGetProjectQuery({
    variables: { subdomain: appSubdomain as string },
    skip: !shouldFetchProject && target === 'console-next',
    fetchPolicy: 'cache-and-network',
    pollInterval: poll ? 5000 * 2 : 0, // every 10s
  });

  // Fetch project data for 'user-project' target using client.graphql
  const {
    data: userProjectData,
    isFetching: userProjectFetching,
    refetch: refetchUserProject,
  } = useQuery(
    ['currentProject', appSubdomain],
    () =>
      client.graphql.request<{ apps: ProjectFragment[] }>(GetProjectDocument, {
        subdomain: (appSubdomain as string) || '',
      }),
    {
      keepPreviousData: true,
      enabled: shouldFetchProject && target === 'user-project',
      staleTime: poll ? 5000 : Infinity, // Adjust staleTime for better performance
    },
  );

  const project =
    target === 'console-next'
      ? consoleData?.apps?.[0] || null
      : userProjectData?.data?.apps?.[0] || null;

  const loading =
    target === 'console-next'
      ? consoleLoading || isAuthLoading
      : userProjectFetching || isAuthLoading;
  const error = consoleError
    ? new Error(consoleError.message || 'Unknown error occurred.')
    : null;

  const refetch =
    target === 'console-next' ? refetchConsole : refetchUserProject;

  if (isPlatform) {
    return {
      project,
      loading,
      error,
      refetch,
    };
  }

  return {
    project: localApplication,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}
