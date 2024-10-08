import { DEFAULT_RATE_LIMITS } from '@/features/orgs/projects/rate-limiting/settings/utils/constants';
import { parseIntervalNameUnit } from '@/features/orgs/projects/rate-limiting/settings/utils/parseIntervalNameUnit';
import {
  useGetLocalRunServiceRateLimitQuery,
  useGetRunServicesRateLimitQuery,
  type GetRunServicesRateLimitQuery,
} from '@/utils/__generated__/graphql';
import { useMemo } from 'react';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

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
    enabled?: boolean;
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
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { data, loading: loadingPlatformServices } =
    useGetRunServicesRateLimitQuery({
      variables: {
        appID: project?.id,
        resolve: false,
      },
      skip: !isPlatform,
    });

  const { loading: loadingLocalServices, data: localServicesData } =
    useGetLocalRunServiceRateLimitQuery({
      variables: { appID: project?.id, resolve: false },
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
    const enabled = service?.config?.ports?.some(
      (port) => port?.rateLimit && port?.type === 'http' && port?.publish,
    );

    const ports = service?.config?.ports?.map((port) => {
      const { interval, intervalUnit } = parseIntervalNameUnit(
        port?.rateLimit?.interval,
      );
      const rateLimit = {
        limit: port?.rateLimit?.limit || DEFAULT_RATE_LIMITS.limit,
        interval: interval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: intervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      };
      return {
        type: port?.type,
        publish: port?.publish,
        port: port?.port,
        rateLimit,
      };
    });

    return {
      enabled,
      name: service.config?.name,
      id: service.id ?? service.serviceID,
      ports,
    };
  });

  return { services: servicesInfo, loading };
}
