import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export const EXPORT_METADATA_QUERY_KEY = 'export-metadata';
const EXPORT_METADATA_STALE_TIME = 5 * 60_000;

export interface UseExportMetadataOptions {
  enabled?: boolean;
}

/**
 * This hook fetches metadata from the Hasura API and caches it.
 *
 * All hooks that need metadata should call this hook with a `select` function
 * to derive their specific data slice from the cached response.
 *
 */
export default function useExportMetadata<T>(
  select: (data: ExportMetadataResponse) => T,
  options?: UseExportMetadataOptions,
): UseQueryResult<T, unknown> {
  const { project, loading } = useProject();

  return useQuery<ExportMetadataResponse, unknown, T>({
    queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return fetchExportMetadata({ appUrl, adminSecret });
    },
    staleTime: EXPORT_METADATA_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      options?.enabled !== false &&
      !loading
    ),
    select,
  });
}
