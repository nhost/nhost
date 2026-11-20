import { useMemo } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetAllRunServicesQuery,
  useGetLocalRunServiceConfigsQuery,
} from '@/generated/graphql';

/**
 * Every Run service of the project, unpaginated. Use it wherever the whole set
 * matters (settings, project-wide checks); the paginated Services list uses
 * `useRunServices` instead.
 */
export default function useAllRunServices() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const {
    data,
    loading: loadingPlatformServices,
    error: platformServicesError,
    refetch: refetchPlatformServices,
  } = useGetAllRunServicesQuery({
    variables: { appID: project?.id, resolve: false },
    skip: !isPlatform || !project?.id,
  });

  const {
    data: localServicesData,
    loading: loadingLocalServices,
    error: localServicesError,
    refetch: refetchLocalServices,
  } = useGetLocalRunServiceConfigsQuery({
    variables: { appID: project?.id as string, resolve: false },
    skip: isPlatform || !project?.id,
    client: localMimirClient,
  });

  const platformServices = useMemo(
    () => data?.app?.runServices.map((service) => service) ?? [],
    [data],
  );

  const localServices = useMemo(
    () => localServicesData?.runServiceConfigs.map((service) => service) ?? [],
    [localServicesData],
  );

  const services: RunService[] = isPlatform ? platformServices : localServices;
  const loading = isPlatform ? loadingPlatformServices : loadingLocalServices;
  const error = isPlatform ? platformServicesError : localServicesError;
  const refetch = isPlatform ? refetchPlatformServices : refetchLocalServices;

  return { services, loading, error, refetch };
}
