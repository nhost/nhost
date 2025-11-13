import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';
import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type {
  FetchTableRowsOptions,
  FetchTableRowsResult,
} from './fetchTableRows';
import fetchTableRows from './fetchTableRows';

export interface UseTableRowsQueryOptions
  extends Pick<
    FetchTableRowsOptions,
    'limit' | 'filters' | 'offset' | 'orderBy' | 'columnNames'
  > {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions;
}

function useTableRows(
  queryKey: QueryKey,
  { queryOptions, ...options }: UseTableRowsQueryOptions,
) {
  const { project } = useProject();
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
    isReady,
  } = useRouter();

  const dependenciesLoaded =
    isNotEmptyValue(project) && isNotEmptyValue(options.columnNames) && isReady;
  return useQuery<FetchTableRowsResult>(queryKey, {
    queryFn: () => {
      const appUrl = isNotEmptyValue(project)
        ? generateAppServiceUrl(project!.subdomain, project!.region, 'hasura')
        : '';
      return fetchTableRows({
        appUrl,
        dataSource: dataSourceSlug as string,
        schema: schemaSlug as string,
        table: tableSlug as string,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : project!.config!.hasura.adminSecret,
        ...options,
      });
    },
    retry: false,
    keepPreviousData: true,
    ...(queryOptions && { queryOptions }),
    enabled: isNotEmptyValue(queryOptions?.enabled)
      ? queryOptions.enabled && dependenciesLoaded
      : dependenciesLoaded,
  });
}

export default useTableRows;
