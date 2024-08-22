import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  useGetLocalRunServiceRateLimitQuery,
  useGetRunServicesRateLimitQuery,
  type GetRunServicesRateLimitQuery,
} from '@/utils/__generated__/graphql';
import { parseIntervalNameUnit } from 'features/projects/rate-limiting/settings/utils/parseIntervalNameUnit';
import { useMemo } from 'react';

type RunService = Pick<
  GetRunServicesRateLimitQuery['app']['runServices'][0],
  'config'
> & {
  id?: string;
  serviceID?: string;
  createdAt?: string;
  updatedAt?: string;
  subdomain?: string;
};

export interface UseGetRunServiceRateLimitsReturn {
  services: {
    name?: string;
    id?: string;
    ports?: {
      type?: string;
      port?: string;
      publish?: boolean;
      rateLimit?: {
        limit?: number;
        interval?: number;
        intervalUnit?: string;
      };
    }[];
  }[];
  loading: boolean;
}

export default function useGetRunServiceRateLimits(): UseGetRunServiceRateLimitsReturn {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { data, loading: loadingPlatformServices } =
    useGetRunServicesRateLimitQuery({
      variables: {
        appID: currentProject?.id,
        resolve: false,
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

  const services: RunService[] = isPlatform ? platformServices : localServices;
  const loading = isPlatform ? loadingPlatformServices : loadingLocalServices;

  const servicesInfo = services.map((service) => {
    const ports = service.config?.ports?.map((port) => {
      const { interval, intervalUnit } = parseIntervalNameUnit(
        port?.rateLimit?.interval,
      );
      const rateLimit = {
        limit: port?.rateLimit?.limit || 1000,
        interval: interval || 5,
        intervalUnit: intervalUnit || 'm',
      };
      return {
        type: port?.type,
        publish: port?.publish,
        port: port?.port,
        rateLimit,
      };
    });
    return {
      name: service.config?.name,
      id: service.id ?? service.serviceID,
      ports,
    };
  });

  return { services: servicesInfo, loading };
}
