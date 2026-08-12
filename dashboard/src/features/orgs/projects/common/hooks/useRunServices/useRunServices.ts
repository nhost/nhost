import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  getPageNumberFromQuery,
  useUrlPagination,
} from '@/features/orgs/projects/common/hooks/useUrlPagination';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type GetRunServicesQuery,
  useGetLocalRunServiceConfigsQuery,
  useGetRunServicesQuery,
} from '@/generated/graphql';
import { getPaginationOffset } from '@/utils/getPaginationOffset';

export type RunService = Pick<
  NonNullable<GetRunServicesQuery['app']>['runServices'][number],
  'config'
> & {
  id?: string;
  serviceID?: string;
  createdAt?: string;
  updatedAt?: string;
  subdomain?: string;
};

export type RunServiceConfig = Omit<
  NonNullable<
    NonNullable<GetRunServicesQuery['app']>['runServices'][number]['config']
  >,
  '__typename'
>;

const ELEMENTS_PER_PAGE = 25;

export default function useRunServices() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const currentPage = getPageNumberFromQuery(router.query.page);
  const offset = useMemo(
    () => getPaginationOffset(currentPage, ELEMENTS_PER_PAGE),
    [currentPage],
  );

  const {
    data,
    loading: loadingPlatformServices,
    refetch: refetchPlatformServices,
  } = useGetRunServicesQuery({
    variables: {
      appID: project?.id,
      resolve: false,
      limit: ELEMENTS_PER_PAGE,
      offset,
    },
    skip: !isPlatform,
  });

  const {
    loading: loadingLocalServices,
    data: localServicesData,
    refetch: refetchLocalServices,
  } = useGetLocalRunServiceConfigsQuery({
    variables: { appID: project?.id as string, resolve: false },
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

  const totalServicesCount = isPlatform
    ? (data?.app?.runServices_aggregate.aggregate?.count ?? 0)
    : 0;

  const { nrOfPages, goToPage, goToNextPage, goToPreviousPage } =
    useUrlPagination({
      currentPage,
      elementsPerPage: ELEMENTS_PER_PAGE,
      totalNrOfElements: totalServicesCount,
      loading,
    });

  return {
    services,
    loading,
    refetch,

    limit: ELEMENTS_PER_PAGE,
    totalServicesCount,
    nrOfPages,

    currentPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
}
