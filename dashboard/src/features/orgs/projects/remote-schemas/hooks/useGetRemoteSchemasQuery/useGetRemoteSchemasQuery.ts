import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import getRemoteSchemas from './getRemoteSchemas';

export interface UseGetRemoteSchemasQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<RemoteSchemaInfo[], unknown>;
}

/**
 * This hook is a wrapper around a fetch call that gets the remote schemas.
 *
 * @param queryKey - Query key to use for caching.
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetRemoteSchemasQuery(
  queryKey: QueryKey,
  { queryOptions }: UseGetRemoteSchemasQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery<RemoteSchemaInfo[]>(
    queryKey,
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret =
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? getHasuraAdminSecret()
          : project?.config?.hasura.adminSecret!;

      return getRemoteSchemas({ appUrl, adminSecret });
    },
    {
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        queryOptions?.enabled !== false &&
        !loading
      ),
    },
  );

  return query;
}
