import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { localApplication } from '@/features/orgs/utils/local-dashboard';
import {
  GetProjectDocument,
  type GetProjectQuery,
  type ProjectFragment,
} from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';

type Project = GetProjectQuery['apps'][0];

export interface UseProjectReturnType {
  project: Project | null;
  loading?: boolean;
  error?: Error | null;
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  refetch: (variables?: any) => Promise<any>;
  projectNotFound: boolean;
}

export default function useProject(): UseProjectReturnType {
  const { appSubdomain } = useParams({ strict: false });
  const nhost = useNhostClient();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const shouldFetchProject = useMemo(
    () => isPlatform && isAuthenticated && !isAuthLoading && !!appSubdomain,
    [isPlatform, isAuthenticated, isAuthLoading, appSubdomain],
  );

  const { data, isLoading, refetch, error, isFetched } = useQuery({
    queryKey: ['project', appSubdomain],
    queryFn: async () => {
      const response = await nhost.graphql.request<{
        apps: ProjectFragment[];
      }>(GetProjectDocument, { subdomain: appSubdomain ?? '' });

      return response?.body.data;
    },
    enabled: shouldFetchProject,
  });

  if (isPlatform) {
    return {
      project: data?.apps?.[0] || null,
      loading: isLoading && shouldFetchProject,
      error: Array.isArray(error || {}) ? error?.[0] : error,
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
