import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
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
    adminSecret: customAdminSecret,
    queryOptions,
  }: UseDatabaseQueryOptions = {},
) {
  const {
    query: { dataSourceSlug },
    isReady,
  } = useRouter();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
    'hasura',
  );

  const query = useQuery<FetchDatabaseReturnType>(
    queryKey,
    () =>
      fetchDatabase({
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : customAdminSecret || currentApplication?.hasuraGraphqlAdminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      }),
    {
      ...queryOptions,
      enabled:
        currentApplication?.hasuraGraphqlAdminSecret && isReady
          ? queryOptions?.enabled
          : false,
    },
  );

  return query;
}
