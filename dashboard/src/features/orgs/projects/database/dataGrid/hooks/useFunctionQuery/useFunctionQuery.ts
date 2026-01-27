import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  FetchFunctionDefinitionOptions,
  FetchFunctionDefinitionReturnType,
} from './fetchFunctionDefinition';
import fetchFunctionDefinition from './fetchFunctionDefinition';

export interface UseFunctionQueryOptions
  extends Partial<FetchFunctionDefinitionOptions> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<FetchFunctionDefinitionReturnType>;
}

/**
 * This hook is a wrapper around a fetch call that gets the CREATE FUNCTION SQL
 * definition for a table-returning function.
 *
 * @param queryKey - Query key to use for caching.
 * @param options - Options to use for the query.
 * @returns The function definition SQL.
 */
export default function useFunctionQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    schema: customSchema,
    table: customFunctionName,
    appUrl: customAppUrl,
    adminSecret: customAdminSecret,
    queryOptions,
    ...options
  }: UseFunctionQueryOptions = {},
) {
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
    isReady,
  } = useRouter();
  const { project } = useProject();

  return useQuery<FetchFunctionDefinitionReturnType>({
    queryKey,
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return fetchFunctionDefinition({
        ...options,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customFunctionName || (tableSlug as string),
      });
    },
    retry: false,
    keepPreviousData: true,
    ...(queryOptions && { queryOptions }),
    enabled:
      isNotEmptyValue(project) && project?.config?.hasura.adminSecret && isReady
        ? queryOptions?.enabled
        : false,
  });
}
