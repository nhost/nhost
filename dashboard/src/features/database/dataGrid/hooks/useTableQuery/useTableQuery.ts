import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
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
  const { currentProject } = useCurrentWorkspaceAndProject();
  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
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
            ? getHasuraAdminSecret()
            : customAdminSecret || currentProject?.config?.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (tableSlug as string),
      }),
    {
      retry: false,
      keepPreviousData: true,
      ...queryOptions,
      enabled:
        currentProject?.config?.hasura.adminSecret && isReady
          ? queryOptions?.enabled
          : false,
    },
  );
}
