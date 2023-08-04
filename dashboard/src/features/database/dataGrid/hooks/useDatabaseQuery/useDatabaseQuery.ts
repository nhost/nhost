import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { getHasuraAdminSecretFromLocalStorage } from '@/utils/helpers';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type {
  FetchDatabaseOptions,
  FetchDatabaseReturnType,
} from './fetchDatabase';
import fetchDatabase from './fetchDatabase';

export interface UseDatabaseQueryOptions extends Partial<FetchDatabaseOptions> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions;
}

/**
 * This hook is a wrapper around a fetch call that gets the available schemas
 * and tables of the current data source.
 *
 * @param queryKey - Query key to use for caching.
 * @param options - Options to use for the query.
 * @returns The available schemas and tables.
 */
export default function useDatabaseQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    appUrl: customAppUrl,
    queryOptions,
  }: UseDatabaseQueryOptions = {},
) {
  const {
    query: { dataSourceSlug },
    isReady,
  } = useRouter();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'hasura',
  );

  const query = useQuery<FetchDatabaseReturnType>(
    queryKey,
    () =>
      fetchDatabase({
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : getHasuraAdminSecretFromLocalStorage(),
        dataSource: customDataSource || (dataSourceSlug as string),
      }),
    {
      ...queryOptions,
      enabled:
        currentProject?.config?.hasura.adminSecret && isReady
          ? queryOptions?.enabled
          : false,

      // We set retry false here so we can quickly detect from the first failed request
      // whether we have the Hasura Admin Secret or not
      retry: false,
    },
  );

  return query;
}
