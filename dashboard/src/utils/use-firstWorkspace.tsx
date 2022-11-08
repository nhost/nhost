import { useWorkspaceContext } from '@/context/workspace-context';
import { useGetUserAllWorkspacesQuery } from '@/generated/graphql';
import { useWithin } from '@/hooks/useWithin';

export const useUserFirstWorkspace = () => {
  const { workspaceContext } = useWorkspaceContext();
  const { within } = useWithin();
  const fetch = !!workspaceContext.slug || !within;

  const { loading, error, data, stopPolling, client } =
    useGetUserAllWorkspacesQuery({
      pollInterval: 1000,
      skip: fetch,
      fetchPolicy: 'cache-first',
    });

  if (!!workspaceContext.slug || !within) {
    stopPolling();
  }

  return {
    loading,
    error,
    data,
    stopPolling,
    within,
    client,
  };
};

export default useUserFirstWorkspace;
