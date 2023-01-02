import { useWorkspaceContext } from '@/context/workspace-context';
import { useGetUserAllWorkspacesQuery } from '@/generated/graphql';
import { useWithin } from '@/hooks/useWithin';
import { useEffect } from 'react';

export const useUserFirstWorkspace = () => {
  const { workspaceContext } = useWorkspaceContext();
  const { within } = useWithin();
  const fetch = !!workspaceContext.slug || !within;

  const { loading, error, data, startPolling, stopPolling, client } =
    useGetUserAllWorkspacesQuery({
      skip: fetch,
      fetchPolicy: 'cache-first',
    });

  useEffect(() => {
    startPolling(1000);
  }, [startPolling]);

  useEffect(() => {
    if (!workspaceContext.slug && within) {
      return;
    }

    stopPolling();
  }, [workspaceContext.slug, within, stopPolling]);

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
