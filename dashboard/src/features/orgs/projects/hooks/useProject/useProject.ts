import { localApplication } from '@/features/orgs/utils/local-dashboard';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetProjectDocument, type GetProjectQuery,
  type ProjectFragment
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
  poll = false
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

  // Fetch project data for 'user-project' target using client.graphql
  const {
    data,
    isFetching,
    refetch,
    error
  } = useQuery(
    ['currentProject', appSubdomain],
    () =>
      client.graphql.request<{ apps: ProjectFragment[] }>(GetProjectDocument, {
        subdomain: (appSubdomain as string) || '',
      }),
    {
      enabled: shouldFetchProject,
      keepPreviousData: true,
      staleTime: poll ? 1000 * 10 : Infinity,
    },
  );

  if (isPlatform) {
    return {
      project: data?.data?.apps?.[0] || null,
      loading: isFetching,
      error: Array.isArray(error || {})
      ? error[0]
      : error,
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
