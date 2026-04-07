import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';
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

  const functionOID = customFunctionOID ?? (routerFunctionOID as string);

  return useQuery<FetchFunctionDefinitionReturnType>({
    queryKey,
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return fetchFunctionDefinition({
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        functionOID,
      });
    },
    retry: false,
    keepPreviousData: true,
    ...queryOptions,
    enabled:
      isNotEmptyValue(project) &&
      project?.config?.hasura.adminSecret &&
      isReady &&
      !!functionOID
        ? queryOptions?.enabled
        : false,
  });
}
