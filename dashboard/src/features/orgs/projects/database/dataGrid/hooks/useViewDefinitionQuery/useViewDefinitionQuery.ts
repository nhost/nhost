import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  FetchViewDefinitionOptions,
  FetchViewDefinitionReturnType,
} from './fetchViewDefinition';
import fetchViewDefinition from './fetchViewDefinition';

export interface UseViewDefinitionQueryOptions
  extends Partial<FetchViewDefinitionOptions> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<FetchViewDefinitionReturnType>;
}

/**
 * This hook fetches the view definition SQL for a given view or materialized view.
 *
 * @param queryKey - Query key to use for caching.
 * @param options - Options to use for the query.
 * @returns View definition SQL and view type.
 */
export default function useViewDefinitionQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    schema: customSchema,
    table: customTable,
    appUrl: customAppUrl,
    adminSecret: customAdminSecret,
    queryOptions,
  }: UseViewDefinitionQueryOptions = {},
) {
  const router = useRouter();
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
    isReady,
  } = router;
  const { project } = useProject();
  const hasuraApi = useHasuraApiTarget();

  const query = useQuery<FetchViewDefinitionReturnType>({
    queryKey,
    queryFn: () => {
      const appUrl = hasuraApi!.appUrl;
      return fetchViewDefinition({
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (tableSlug as string),
        appUrl: customAppUrl || appUrl,
        adminSecret: customAdminSecret || hasuraApi!.adminSecret,
      });
    },
    ...queryOptions,
    enabled:
      project?.config?.hasura.adminSecret &&
      isReady &&
      (customSchema || schemaSlug) &&
      (customTable || tableSlug)
        ? queryOptions?.enabled
        : false,
  });

  return query;
}
