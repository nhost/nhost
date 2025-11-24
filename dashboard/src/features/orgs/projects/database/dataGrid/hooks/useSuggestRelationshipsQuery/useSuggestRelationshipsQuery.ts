import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuggestRelationshipsResponse } from '@/utils/hasura-api/generated/schemas';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import suggestRelationships from './suggestRelationships';

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

  const query = useQuery(
    ['suggest-relationships', source ?? 'default'],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project?.config?.hasura.adminSecret!;

      return suggestRelationships({
        appUrl,
        adminSecret,
        args: {
          source: source ?? 'default',
          omit_tracked: false,
        },
      });
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
