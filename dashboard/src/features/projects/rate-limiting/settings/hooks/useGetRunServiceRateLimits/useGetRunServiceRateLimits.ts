import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  useGetLocalRunServiceRateLimitQuery,
  useGetRunServicesRateLimitQuery,
  type GetRunServicesRateLimitQuery,
} from '@/utils/__generated__/graphql';
import { useMemo } from 'react';

type RunServiceRateLimit = Pick<
  GetRunServicesRateLimitQuery['app']['runServices'][0],
  'config'
> & {
  id?: string;
  serviceID?: string;
  createdAt?: string;
  updatedAt?: string;
  subdomain?: string;
};

export default function useGetRunServiceRateLimits() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { data, loading: loadingPlatformServices } =
    useGetRunServicesRateLimitQuery({
      variables: {
        appID: currentProject?.id,
        resolve: false,
        limit: 25,
        offset: 0,
      },
      skip: !isPlatform,
    });

  const { loading: loadingLocalServices, data: localServicesData } =
    useGetLocalRunServiceRateLimitQuery({
      variables: { appID: currentProject?.id, resolve: false },
      skip: isPlatform,
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

  const services: RunServiceRateLimit[] = isPlatform
    ? platformServices
    : localServices;
  const loading = isPlatform ? loadingPlatformServices : loadingLocalServices;

  const servicesInfo = services.map((service) => {
    const ports = service.config?.ports?.map((port) => ({
      type: port?.type,
      port: port?.port,
      rateLimit: port?.rateLimit,
    }));
    return {
      id: service.id,
      ports,
    };
  });

  return { services: servicesInfo, loading };
}
