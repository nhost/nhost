import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { localApplication } from '@/features/orgs/utils/local-dashboard';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';
import {
  GetProjectDocument,
  type GetProjectQuery,
  type ProjectFragment,
} from '@/utils/__generated__/graphql';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

type Project = GetProjectQuery['apps'][0];

export interface UseProjectReturnType {
  project: Project | null;
  loading?: boolean;
  error?: Error | null;
  refetch: (variables?: any) => Promise<any>;
}

export default function useProject(): UseProjectReturnType {
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

  const { data, isLoading, refetch, error } = useQuery(
    ['project', appSubdomain as string],
    async () => {
      const response = await nhost.graphql.post<{
        apps: ProjectFragment[];
      }>(GetProjectDocument, { subdomain: (appSubdomain as string) || '' });
      return response.body;
    },
    {
      enabled: shouldFetchProject,
    },
  );

  if (isPlatform) {
    return {
      project: data?.data?.apps?.[0] || null,
      loading: isLoading && shouldFetchProject,
      error: Array.isArray(error || {}) ? error?.[0] : error,
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
