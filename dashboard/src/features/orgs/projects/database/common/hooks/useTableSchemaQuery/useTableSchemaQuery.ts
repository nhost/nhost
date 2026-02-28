import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  FetchTableSchemaOptions,
  FetchTableSchemaReturnType,
} from './fetchTableSchema';
import fetchTableSchema from './fetchTableSchema';

export interface UseTableSchemaQueryOptions
  extends Partial<FetchTableSchemaOptions> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<FetchTableSchemaReturnType>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Fetches the schema of a table (columns and foreign key relations) without
 * fetching any row data.
 *
 * @param queryKey - Query key to use for caching.
 * @param options - Options to use for the query.
 * @returns The columns and foreign key relations of the table.
 */
export default function useTableSchemaQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    schema: customSchema,
    table: customTable,
    appUrl: customAppUrl,
    adminSecret: customAdminSecret,
    queryOptions,
  }: UseTableSchemaQueryOptions = {},
) {
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
    isReady,
  } = useRouter();
  const { project } = useProject();

  return useQuery<FetchTableSchemaReturnType>({
    queryKey,
    queryFn: async () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const schema = customSchema || (schemaSlug as string);
      const table = customTable || (tableSlug as string);

      return await fetchTableSchema({
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
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
