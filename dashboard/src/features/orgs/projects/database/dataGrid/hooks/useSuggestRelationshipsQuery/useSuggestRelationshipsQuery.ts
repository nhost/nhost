import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import suggestRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery/suggestRelationships';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuggestRelationshipsResponse } from '@/utils/hasura-api/generated/schemas';

export const getSuggestRelationshipsQueryKey = (
  source?: string,
): readonly ['suggest-relationships', string] =>
  ['suggest-relationships', source ?? 'default'] as const;

export interface UseSuggestRelationshipsQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      SuggestRelationshipsResponse,
      unknown,
      SuggestRelationshipsResponse,
      readonly ['suggest-relationships', string]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets all the relationships that can be tracked by the pg_create_*_relationship API.
 *
 * @param source - Name of the source database to suggest relationships for
 * @returns The result of the query.
 */
export default function useSuggestRelationshipsQuery(
  source?: string,
  { queryOptions }: UseSuggestRelationshipsQueryOptions = {},
) {
  const { project, loading } = useProject();
  const adminApi = useAdminApiTarget();

  return useQuery({
    queryKey: getSuggestRelationshipsQueryKey(source),
    queryFn: () => {
      if (!adminApi) {
        throw new Error('Admin API is not available.');
      }

      return suggestRelationships({
        appUrl: adminApi.appUrl,
        adminSecret: adminApi.adminSecret,
        args: {
          source: source ?? 'default',
          omit_tracked: false,
        },
      });
    },
    ...queryOptions,
    enabled: Boolean(
      project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        queryOptions?.enabled !== false &&
        !loading,
    ),
  });
}
