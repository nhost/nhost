import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type {
  FetchMetadataOptions,
  FetchMetadataReturnType,
} from './fetchMetadata';
import fetchMetadata from './fetchMetadata';

export interface UseDataBrowserDatabaseQueryOptions
  extends Partial<FetchMetadataOptions> {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<FetchMetadataReturnType>;
}

/**
 * This hook is a wrapper around a fetch call that exports the Hasura metadata.
 *
 * @param queryKey - Query key to use for caching.
 * @param options - Options to use for the query.
 * @returns Hasura metadata
 */
export default function useMetadataQuery(
  queryKey: QueryKey,
  {
    dataSource: customDataSource,
    appUrl: customAppUrl,
    adminSecret: customAdminSecret,
    queryOptions,
    ...options
  }: UseDataBrowserDatabaseQueryOptions = {},
) {
  const {
    query: { dataSourceSlug },
    isReady,
  } = useRouter();
  const { project } = useProject();
  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );

  const query = useQuery<FetchMetadataReturnType>(
    queryKey,
    () =>
      fetchMetadata({
        ...options,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project?.config?.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      }),
    {
      ...queryOptions,
      enabled:
        project?.config?.hasura.adminSecret && isReady
          ? queryOptions?.enabled
          : false,
    },
  );

  return query;
}
