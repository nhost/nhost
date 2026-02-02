import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { FetchTableRelatedObjectsReturnType } from './fetchTableRelatedObjects';
import fetchTableRelatedObjects from './fetchTableRelatedObjects';

export interface UseTableRelatedObjectsQueryOptions {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table name.
   */
  table: string;
  /**
   * Data source name.
   */
  dataSource?: string;
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<FetchTableRelatedObjectsReturnType>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Hook to fetch related database objects for a table (constraints, triggers, indexes).
 */
export default function useTableRelatedObjectsQuery(
  queryKey: QueryKey,
  {
    schema,
    table,
    dataSource: customDataSource,
    queryOptions,
  }: UseTableRelatedObjectsQueryOptions,
) {
  const {
    query: { dataSourceSlug },
    isReady,
  } = useRouter();
  const { project } = useProject();

  const query = useQuery<FetchTableRelatedObjectsReturnType>({
    queryKey,
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      return fetchTableRelatedObjects({
        appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : project!.config!.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string) || 'default',
        schema,
        table,
      });
    },
    ...queryOptions,
    enabled:
      project?.config?.hasura.adminSecret && isReady && !!schema && !!table
        ? (queryOptions?.enabled ?? true)
        : false,
  });

  return query;
}
