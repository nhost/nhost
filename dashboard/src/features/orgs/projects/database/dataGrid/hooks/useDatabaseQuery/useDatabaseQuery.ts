import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  FetchDatabaseOptions,
  FetchDatabaseReturnType,
} from './fetchDatabase';
import fetchDatabase from './fetchDatabase';

const DATABASE_QUERY_STALE_TIME = 60_000;

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

  const hasuraApi = useHasuraApiTarget();

  const query = useQuery<FetchDatabaseReturnType>({
    queryKey,
    staleTime: DATABASE_QUERY_STALE_TIME,
    queryFn: () => {
      const appUrl = hasuraApi!.appUrl;
      return fetchDatabase({
        appUrl: customAppUrl || appUrl,
        adminSecret: customAdminSecret || hasuraApi!.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      });
    },
    ...queryOptions,
    enabled:
      project?.config?.hasura.adminSecret && isReady
        ? queryOptions?.enabled
        : false,
  });

  return query;
}
