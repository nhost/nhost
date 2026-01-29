import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export interface UseGetDataSourcesOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<ExportMetadataResponse, unknown, string[]>;
}

/**
 * This hook gets the data sources names from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetDataSources({
  queryOptions,
}: UseGetDataSourcesOptions = {}) {
  const { project } = useProject();

  const query = useQuery<ExportMetadataResponse, unknown, string[]>({
    queryKey: ['export-metadata', project?.subdomain],
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return fetchExportMetadata({ appUrl, adminSecret });
    },
    ...queryOptions,
    select: (data) =>
      data.metadata?.sources?.reduce<string[]>((acc, source) => {
        if (source.name) {
          acc.push(source.name);
        }
        return acc;
      }, []) ?? [],
  });

  return query;
}
