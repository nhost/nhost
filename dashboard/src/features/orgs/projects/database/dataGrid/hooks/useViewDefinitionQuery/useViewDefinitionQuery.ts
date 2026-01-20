import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
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

  const query = useQuery<FetchViewDefinitionReturnType>(
    queryKey,
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      return fetchViewDefinition({
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (tableSlug as string),
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project!.config!.hasura.adminSecret,
      });
    },
    {
      ...queryOptions,
      enabled:
        project?.config?.hasura.adminSecret &&
        isReady &&
        (customSchema || schemaSlug) &&
        (customTable || tableSlug)
          ? queryOptions?.enabled
          : false,
    },
  );

  return query;
}
