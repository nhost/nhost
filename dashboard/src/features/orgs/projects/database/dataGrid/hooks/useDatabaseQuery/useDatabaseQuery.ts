import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  FetchDatabaseOptions,
  FetchDatabaseReturnType,
} from './fetchDatabase';
import fetchDatabase from './fetchDatabase';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';

export interface UseDatabaseQueryOptions extends Partial<FetchDatabaseOptions> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<FetchDatabaseReturnType>;
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

  const { project } = useProject();
  const { data: metadata } = useGetMetadata();
  const defaultDataSource = metadata?.sources?.find(
    (source) => source.name === 'default',
  );

  const defaultDataSourceFunctions = new Set(
    defaultDataSource?.functions?.map(
      (func) => `${func.function.schema}.${func.function.name}`,
    ) ?? [],
  );

  const query = useQuery<FetchDatabaseReturnType>(
    queryKey,
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      return fetchDatabase({
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      });
    },
    {
      ...queryOptions,
      enabled:
        project?.config?.hasura.adminSecret && isReady
          ? queryOptions?.enabled
          : false,
      select: (data) => ({
        ...data,
        // TODO: Check if this is necessary
        functions: data.functions?.filter(
          (func) =>
            func.table_type === 'FUNCTION' &&
            defaultDataSourceFunctions.has(
              `${func.table_schema}.${func.table_name}`,
            ),
        ),
      }),
    },
  );

  return query;
}
