import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type { FetchTableOptions, FetchTableReturnType } from './fetchTable';
import fetchTable from './fetchTable';

export interface UseDataBrowserDatabaseQueryOptions
  extends Partial<FetchTableOptions> {
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
export default function useTableQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    schema: customSchema,
    table: customTable,
    appUrl: customAppUrl,
    adminSecret: customAdminSecret,
    queryOptions,
    ...options
  }: UseDataBrowserDatabaseQueryOptions = {},
) {
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
    isReady,
  } = useRouter();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
    'hasura',
  );

  return useQuery<FetchTableReturnType>(
    queryKey,
    () =>
      fetchTable({
        ...options,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : customAdminSecret || currentApplication?.hasuraGraphqlAdminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (tableSlug as string),
      }),
    {
      retry: false,
      keepPreviousData: true,
      ...queryOptions,
      enabled:
        currentApplication?.hasuraGraphqlAdminSecret && isReady
          ? queryOptions?.enabled
          : false,
    },
  );
}
