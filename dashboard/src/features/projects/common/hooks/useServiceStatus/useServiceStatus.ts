import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { ServiceHealthInfo } from '@/features/projects/overview/health';
import {
  useGetProjectServicesHealthQuery,
  type GetProjectServicesHealthQuery,
  type GetProjectServicesHealthQueryVariables,
} from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';

export interface UseServiceStatusOptions
  extends QueryHookOptions<
    GetProjectServicesHealthQuery,
    GetProjectServicesHealthQueryVariables
  > {}

export default function useServiceStatus(
  options: UseServiceStatusOptions = {},
) {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading } = useGetProjectServicesHealthQuery({
    ...options,
    variables: { ...options.variables, appId: currentProject?.id },
    skip: !isPlatform || !currentProject,
  });

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
