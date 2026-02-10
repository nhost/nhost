import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { InconsistentMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import getInconsistentMetadata from './getInconsistentMetadata';

export interface UseGetInconsistentMetadataOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<InconsistentMetadataResponse, unknown>;
}

/**
 * This hook gets the inconsistent metadata objects.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetInconsistentMetadata({
  queryOptions,
}: UseGetInconsistentMetadataOptions = {}) {
  const { project } = useProject();

  const query = useQuery<InconsistentMetadataResponse, unknown>({
    queryKey: ['inconsistent-metadata', project?.subdomain],
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return getInconsistentMetadata({ appUrl, adminSecret });
    },
    ...queryOptions,
  });

  return query;
}
