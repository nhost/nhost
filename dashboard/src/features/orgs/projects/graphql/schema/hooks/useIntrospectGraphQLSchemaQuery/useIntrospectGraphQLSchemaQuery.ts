import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { IntrospectionQuery } from 'graphql';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import introspectGraphQLSchema from './introspectGraphQLSchema';

type GraphQLSchemaQueryKey = readonly [
  'graphql-schema',
  string | undefined,
  string,
];

export interface UseIntrospectGraphQLSchemaQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      IntrospectionQuery,
      Error,
      IntrospectionQuery,
      GraphQLSchemaQueryKey
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook introspects the project's GraphQL schema as seen by a role.
 *
 * @param role - Role whose view of the schema is introspected
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useIntrospectGraphQLSchemaQuery(
  role: string,
  { queryOptions }: UseIntrospectGraphQLSchemaQueryOptions = {},
) {
  const { project, loading } = useProject();
  const adminSecret = project?.config?.hasura.adminSecret;

  return useQuery<
    IntrospectionQuery,
    Error,
    IntrospectionQuery,
    GraphQLSchemaQueryKey
  >({
    queryKey: ['graphql-schema', project?.subdomain, role],
    queryFn: () =>
      introspectGraphQLSchema({
        url: generateAppServiceUrl(
          project!.subdomain,
          project!.region,
          'graphql',
        ),
        adminSecret: adminSecret!,
        role,
      }),
    // Errors such as a role without schema access are deterministic.
    retry: false,
    // Introspection can be large; the page refetches on demand instead.
    refetchOnWindowFocus: false,
    ...queryOptions,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      adminSecret &&
      role &&
      queryOptions?.enabled !== false &&
      !loading
    ),
  });
}
