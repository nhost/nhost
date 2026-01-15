import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  ExportMetadataResponse,
  ExportMetadataResponseMetadata,
} from '@/utils/hasura-api/generated/schemas';

export interface UseGetMetadataOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<
    ExportMetadataResponse,
    unknown,
    ExportMetadataResponseMetadata
  >;
}

/**
 * This hook gets the metadata from the Hasura API.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetMetadata({
  queryOptions,
}: UseGetMetadataOptions = {}) {
  const { project } = useProject();

  const query = useQuery<
    ExportMetadataResponse,
    unknown,
    ExportMetadataResponseMetadata
  >(
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
      select: (data) => data.metadata,
    },
  );

  return query;
}
