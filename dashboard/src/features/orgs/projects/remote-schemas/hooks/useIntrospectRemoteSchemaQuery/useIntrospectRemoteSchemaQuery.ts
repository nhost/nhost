import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { IntrospectRemoteSchemaResponse } from '@/utils/hasura-api/generated/schemas';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import introspectRemoteSchema from './introspectRemoteSchema';

export interface UseIntrospectRemoteSchemaQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      IntrospectRemoteSchemaResponse,
      unknown,
      IntrospectRemoteSchemaResponse,
      string[]
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
  const { project } = useProject();

  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );

  const query = useQuery({
    queryKey: ['introspect-remote-schema', remoteSchemaName],
    queryFn: () =>
      introspectRemoteSchema({
        appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : project?.config?.hasura.adminSecret,
        args: {
          name: remoteSchemaName,
        },
      }),
    ...queryOptions,
    enabled: !!(
      project?.config?.hasura.adminSecret &&
      remoteSchemaName &&
      queryOptions?.enabled !== false
    ),
  });

  return query;
}
