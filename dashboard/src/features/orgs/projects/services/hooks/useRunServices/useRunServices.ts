import {
  useGetLocalRunServiceConfigsQuery,
  useGetRunServicesQuery,
  type GetRunServicesQuery,
} from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export type RunService = Pick<
  GetRunServicesQuery['app']['runServices'][0],
  'config'
> & {
  id?: string;
  serviceID?: string;
  createdAt?: string;
  updatedAt?: string;
  subdomain?: string;
};

export type RunServiceConfig = Omit<
  GetRunServicesQuery['app']['runServices'][0]['config'],
  '__typename'
>;

export default function useRunServices() {
  const limit = useRef(25);
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const [nrOfPages, setNrOfPages] = useState(0);
  const [totalServicesCount, setTotalServicesCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );
  const offset = useMemo(() => currentPage - 1, [currentPage]);

  const {
    data,
    loading: loadingPlatformServices,
    refetch: refetchPlatformServices,
  } = useGetRunServicesQuery({
    variables: {
      appID: project?.id,
      resolve: false,
      limit: limit.current,
      offset,
    },
    skip: !isPlatform,
  });

  const {
    loading: loadingLocalServices,
    data: localServicesData,
    refetch: refetchLocalServices,
  } = useGetLocalRunServiceConfigsQuery({
    variables: { appID: project?.id as any, resolve: false },
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
  const refetch = isPlatform ? refetchPlatformServices : refetchLocalServices;

  useEffect(() => {
    if (!isPlatform) {
      return;
    }

    if (loading) {
      return;
    }

    const userCount = data?.app?.runServices_aggregate.aggregate.count ?? 0;

    setTotalServicesCount(
      data?.app?.runServices_aggregate.aggregate.count ?? 0,
    );
    setNrOfPages(Math.ceil(userCount / limit.current));
  }, [data, loading, isPlatform]);

  return {
    services,
    loading,
    refetch,

    limit,
    totalServicesCount,
    nrOfPages,

    currentPage,
    setCurrentPage,
  };
}
