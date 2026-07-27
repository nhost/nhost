import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import type { FetchFunctionDefinitionReturnType } from './fetchFunctionDefinition';
import fetchFunctionDefinition from './fetchFunctionDefinition';

export interface UseFunctionQueryOptions {
  dataSource?: string;
  functionOID?: string;
  appUrl?: string;
  adminSecret?: string;
  queryOptions?: UseQueryOptions<FetchFunctionDefinitionReturnType>;
}

export default function useFunctionQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    functionOID: customFunctionOID,
    appUrl: customAppUrl,
    adminSecret: customAdminSecret,
    queryOptions,
  }: UseFunctionQueryOptions = {},
) {
  const {
    query: { dataSourceSlug, functionOID: routerFunctionOID },
    isReady,
  } = useRouter();
  const { project } = useProject();
  const adminApi = useAdminApiTarget();

  const functionOID = customFunctionOID ?? (routerFunctionOID as string);

  return useQuery<FetchFunctionDefinitionReturnType>({
    queryKey,
    queryFn: () => {
      const appUrl = adminApi!.appUrl;

      return fetchFunctionDefinition({
        appUrl: customAppUrl || appUrl,
        adminSecret: customAdminSecret || adminApi!.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        functionOID,
      });
    },
    retry: false,
    keepPreviousData: true,
    ...queryOptions,
    enabled:
      isNotEmptyValue(project?.config?.hasura.adminSecret) &&
      isReady &&
      functionOID
        ? queryOptions?.enabled
        : false,
  });
}
