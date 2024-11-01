import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ServiceHealthInfo } from '@/features/orgs/projects/overview/health';
import {
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
  const { project } = useProject();

  const isVisible = useVisibilityChange();

  const { data, loading, refetch, startPolling, stopPolling } =
    useGetProjectServicesHealthQuery({
      ...options,
      variables: { ...options.variables, appId: project?.id },
      skip: !isPlatform || !project,
      skipPollAttempt: () => !isVisible,
    });

  // Fetch when mounted
  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (options.shouldPoll) {
      startPolling(options.pollInterval || 10000);
    }

    return () => stopPolling();
  }, [stopPolling, startPolling, options.shouldPoll, options.pollInterval]);

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
