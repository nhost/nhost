import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { ServiceHealthInfo } from '@/features/projects/overview/health';
import {
  ServiceState,
  useGetProjectServicesHealthQuery,
  type GetProjectServicesHealthQuery,
  type GetProjectServicesHealthQueryVariables,
} from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';
import { useVisibilityChange } from '@uidotdev/usehooks';
import { useEffect } from 'react';

export interface UseServiceStatusOptions
  extends QueryHookOptions<
    GetProjectServicesHealthQuery,
    GetProjectServicesHealthQueryVariables
  > {
  shouldPoll?: boolean;
}

export default function useServiceStatus(
  options: UseServiceStatusOptions = {},
) {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  const { data, loading, refetch, startPolling, stopPolling } =
    useGetProjectServicesHealthQuery({
      ...options,
      variables: { ...options.variables, appId: currentProject?.id },
      skip: !isPlatform || !currentProject,
      pollInterval: 0,
      skipPollAttempt: () => !isVisible,
    });

  // Fetch when mounted
  useEffect(() => {
    refetch();
    return () => {
      stopPolling();
    };
  }, [refetch, stopPolling]);

  const serviceMap: { [key: string]: ServiceHealthInfo | undefined } = {};
  data?.getProjectStatus?.services.forEach((service) => {
    serviceMap[service.name] = service;
  });
  const {
    'hasura-auth': auth,
    'hasura-storage': storage,
    postgres,
    hasura,
    ai,
    ...run
  } = serviceMap;

  // Change poll interval based on services states
  useEffect(() => {
    if (!options.shouldPoll) {
      return () => stopPolling();
    }
    if (
      [auth, storage, postgres, hasura, ai, ...Object.values(run)].some(
        (service) => service?.state !== ServiceState.Running,
      )
    ) {
      // Poll more frequently if a service is not running
      startPolling(options.pollInterval || 10000);
    } else {
      // Poll less frequently when all services are running
      startPolling(60000);
    }

    return () => stopPolling();
  }, [
    ai,
    auth,
    hasura,
    postgres,
    run,
    storage,
    options.pollInterval,
    options.shouldPoll,
    startPolling,
    stopPolling,
  ]);

  return {
    loading,
    auth,
    storage,
    postgres,
    hasura,
    ai,
    run,
  };
}
