import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { localApplication } from '@/features/orgs/utils/local-dashboard';
import { isEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';
import {
  GetProjectStateDocument,
  type GetProjectQuery,
  type ProjectFragment,
} from '@/utils/__generated__/graphql';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

type Project = GetProjectQuery['apps'][0];

export interface UseProjectWithStateReturnType {
  project: Project;
  loading?: boolean;
  error?: Error;
  refetch: (variables?: any) => Promise<any>;
  projectNotFound: boolean;
}

export default function useProjectWithState(): UseProjectWithStateReturnType {
  const {
    query: { appSubdomain },
    isReady: isRouterReady,
  } = useRouter();
  const nhost = useNhostClient();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const shouldFetchProject = useMemo(
    () =>
      isPlatform &&
      isAuthenticated &&
      !isAuthLoading &&
      !!appSubdomain &&
      isRouterReady,
    [isPlatform, isAuthenticated, isAuthLoading, appSubdomain, isRouterReady],
  );

  const { data, isLoading, refetch, error, isFetched } = useQuery(
    ['projectWithState', appSubdomain as string],
    async () => {
      const response = await nhost.graphql.post<{
        apps: ProjectFragment[];
      }>(GetProjectStateDocument, {
        subdomain: (appSubdomain as string) || '',
      });
      return response?.body.data;
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
      project: data?.apps?.[0] || null,
      loading: isLoading && shouldFetchProject,
      error: Array.isArray(error || {}) ? error[0] : error,
      refetch,
      projectNotFound: isFetched && !isLoading && isEmptyValue(data?.apps),
    };
  }

  return {
    project: localApplication,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    projectNotFound: false,
  };
}
