import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useIsMaterializedView } from '@/features/orgs/projects/database/dataGrid/hooks/useIsMaterializedView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';
import type { FetchTableOptions, FetchTableReturnType } from './fetchTable';
import fetchTable from './fetchTable';

export interface UseDataBrowserDatabaseQueryOptions
  extends Partial<Omit<FetchTableOptions, 'isMaterializedView'>> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<FetchTableReturnType>,
    'queryKey' | 'queryFn'
  >;
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
  const { project } = useProject();

  const dataSource = customDataSource || (dataSourceSlug as string);
  const schema = customSchema || (schemaSlug as string);
  const table = customTable || (tableSlug as string);

  const isMaterializedView = useIsMaterializedView({
    dataSource,
    schema,
    name: table,
    queryOptions: {
      enabled:
        isNotEmptyValue(project) &&
        !!project?.config?.hasura.adminSecret &&
        isReady
          ? queryOptions?.enabled
          : false,
    },
  });

  return useQuery<FetchTableReturnType>({
    queryKey,
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return fetchTable({
        ...options,
        isMaterializedView,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource,
        schema,
        table,
      });
    },
    retry: false,
    keepPreviousData: true,
    ...queryOptions,
    enabled:
      isNotEmptyValue(project) && project?.config?.hasura.adminSecret && isReady
        ? queryOptions?.enabled
        : false,
  });
}
