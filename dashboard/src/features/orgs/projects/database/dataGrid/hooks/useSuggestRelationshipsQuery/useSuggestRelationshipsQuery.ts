import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuggestRelationshipsResponse } from '@/utils/hasura-api/generated/schemas';
import suggestRelationships from './suggestRelationships';

export const getSuggestRelationshipsQueryKey = (
  projectSubdomain: string | undefined,
  source?: string,
): readonly ['suggest-relationships', string | undefined, string] =>
  ['suggest-relationships', projectSubdomain, source ?? 'default'] as const;

export interface UseSuggestRelationshipsQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      SuggestRelationshipsResponse,
      unknown,
      SuggestRelationshipsResponse,
      readonly ['suggest-relationships', string | undefined, string]
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

  const query = useQuery({
    queryKey: getSuggestRelationshipsQueryKey(project?.subdomain, source),
    queryFn: () => {
      const appUrl = adminApi!.appUrl;

      const adminSecret = adminApi!.adminSecret;

      return suggestRelationships({
        appUrl,
        adminSecret,
        args: {
          source: source ?? 'default',
          omit_tracked: false,
        },
      });
    },
    ...queryOptions,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      queryOptions?.enabled !== false &&
      !loading
    ),
  });

  return query;
}
