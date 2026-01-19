import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { IntrospectionQuery } from 'graphql';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import introspectRemoteSchema from './introspectRemoteSchema';

export interface UseIntrospectRemoteSchemaQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      { data: IntrospectionQuery },
      unknown,
      IntrospectionQuery,
      readonly ['introspect-remote-schema', string]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that introspects a remote schema.
 *
 * @param remoteSchemaName - Name of the remote schema to introspect
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useIntrospectRemoteSchemaQuery(
  remoteSchemaName: string,
  { queryOptions }: UseIntrospectRemoteSchemaQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery<
    { data: IntrospectionQuery },
    unknown,
    IntrospectionQuery,
    readonly ['introspect-remote-schema', string]
  >(
    ['introspect-remote-schema', remoteSchemaName],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return introspectRemoteSchema({
        appUrl,
        adminSecret,
        args: {
          name: remoteSchemaName,
        },
      });
    },
    {
      // Avoid endless retries/refetches on deterministic errors like "remote schema not found"
      retry: false,
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        remoteSchemaName &&
        queryOptions?.enabled !== false &&
        !loading
      ),
      select: (data) => data.data,
    },
  );

  return query;
}
