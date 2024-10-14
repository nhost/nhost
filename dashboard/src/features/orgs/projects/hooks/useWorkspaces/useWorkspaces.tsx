import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  useGetAllWorkspacesAndProjectsQuery,
  type Exact,
  type GetAllWorkspacesAndProjectsQuery,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';

export type Workspace = GetAllWorkspacesAndProjectsQuery['workspaces'][0];

export interface UseWorkspacesReturnType {
  workspaces: Workspace[];
  loading?: boolean;
  error?: Error;
  refetch: (
    variables?: Partial<
      Exact<{
        [key: string]: never;
      }>
    >,
  ) => Promise<any>;
}

export default function useWorkspaces(): UseWorkspacesReturnType {
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } =
    useAuthenticationStatus();

  const shouldFetchWorkspaces = isPlatform && isAuthenticated && !isAuthLoading;

  const { data, loading, error, refetch } = useGetAllWorkspacesAndProjectsQuery(
    {
      fetchPolicy: 'cache-and-network',
      skip: !shouldFetchWorkspaces,
    },
  );

  const workspaces = data?.workspaces || [];

  return {
    workspaces,
    loading: data ? false : loading || isAuthLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
