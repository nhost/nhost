import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export interface UseGetMetadataResourceVersionOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<ExportMetadataResponse, unknown, number>;
}

/**
 * This hook is a wrapper around a fetch call that gets the metadata resource version.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetMetadataResourceVersion({
  queryOptions,
}: UseGetMetadataResourceVersionOptions = {}) {
  const { project } = useProject();

  const query = useQuery<ExportMetadataResponse, unknown, number>(
    ['export-metadata', project?.subdomain],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return fetchExportMetadata({ appUrl, adminSecret });
    },
    {
      ...queryOptions,
      select: (data) => data.resource_version,
    },
  );

  return query;
}
