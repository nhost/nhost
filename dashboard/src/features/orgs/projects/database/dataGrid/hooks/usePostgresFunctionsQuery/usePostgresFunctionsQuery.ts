import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  FetchPostgresFunctionsOptions,
  FetchPostgresFunctionsReturnType,
} from './fetchPostgresFunctions';
import fetchPostgresFunctions from './fetchPostgresFunctions';

export const POSTGRES_FUNCTIONS_QUERY_KEY = 'postgres-functions';
const POSTGRES_FUNCTIONS_STALE_TIME = 60_000;

export interface UsePostgresFunctionsQueryOptions
  extends Partial<FetchPostgresFunctionsOptions> {
  queryOptions?: UseQueryOptions<FetchPostgresFunctionsReturnType>;
}

/**
 * Fetches all non-system, non-variadic, STABLE/IMMUTABLE PostgreSQL functions
 * available in the given data source. Used to populate function pickers
 * (e.g., for computed fields).
 */
export default function usePostgresFunctionsQuery({
  dataSource: customDataSource,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  queryOptions,
}: UsePostgresFunctionsQueryOptions = {}) {
  const {
    query: { dataSourceSlug },
    isReady,
  } = useRouter();

  const { project } = useProject();

  const dataSource = customDataSource || (dataSourceSlug as string);

  const queryKey: QueryKey = [
    POSTGRES_FUNCTIONS_QUERY_KEY,
    project?.subdomain,
    dataSource,
  ];

  return useQuery<FetchPostgresFunctionsReturnType>({
    queryKey,
    staleTime: POSTGRES_FUNCTIONS_STALE_TIME,
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      return fetchPostgresFunctions({
        appUrl: customAppUrl || appUrl,
        adminSecret: customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource,
      });
    },
    ...queryOptions,
    enabled:
      project?.config?.hasura.adminSecret && isReady
        ? queryOptions?.enabled
        : false,
  });
}
