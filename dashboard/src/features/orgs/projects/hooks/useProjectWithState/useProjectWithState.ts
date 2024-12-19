import { localApplication } from '@/features/orgs/utils/local-dashboard';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetProjectStateDocument,
  type GetProjectQuery,
  type ProjectFragment,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus, useNhostClient } from '@nhost/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

type Project = GetProjectQuery['apps'][0];

export interface UseProjectWithStateReturnType {
  project: Project;
  loading?: boolean;
  error?: Error;
  refetch: (variables?: any) => Promise<any>;
}

export default function useProjectWithState(): UseProjectWithStateReturnType {
  const {
    query: { appSubdomain },
    isReady: isRouterReady,
  } = useRouter();
  const client = useNhostClient();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } =
    useAuthenticationStatus();

  const shouldFetchProject = useMemo(
    () =>
      isPlatform &&
      isAuthenticated &&
      !isAuthLoading &&
      !!appSubdomain &&
      isRouterReady,
    [isPlatform, isAuthenticated, isAuthLoading, appSubdomain, isRouterReady],
  );

  const { data, isLoading, refetch, error } = useQuery(
    ['projectWithState', appSubdomain as string],
    async () => {
      const response = await client.graphql.request<{
        apps: ProjectFragment[];
      }>(GetProjectStateDocument, {
        subdomain: (appSubdomain as string) || '',
      });
      return response;
    },
    {
      enabled: shouldFetchProject,
      keepPreviousData: true,
      refetchOnWindowFocus: true,
      refetchInterval: 10000, // poll every 10s
      staleTime: 1000 * 60 * 5, // 1 minutes
      cacheTime: 1000 * 60 * 6, //
    },
  );

  if (isPlatform) {
    return {
      project: data?.data?.apps?.[0] || null,
      loading: isLoading && shouldFetchProject,
      error: Array.isArray(error || {}) ? error[0] : error,
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
