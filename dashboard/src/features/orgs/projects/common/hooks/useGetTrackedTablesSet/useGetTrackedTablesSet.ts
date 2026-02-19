import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export interface UseGetTrackedTablesSetOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<ExportMetadataResponse, unknown, Set<string>>;
  /**
   * The data source to get the tracked tables names for.
   */
  dataSource: string;
}

/**
 * This hook gets the tracked tables for a data source as a Set of
 * "schema.name" qualified strings. The Set is constructed once per fetch
 * and memoized by React Query until the underlying data changes.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetTrackedTablesSet({
  dataSource,
  queryOptions,
}: UseGetTrackedTablesSetOptions) {
  const { project, loading } = useProject();

  const query = useQuery<ExportMetadataResponse, unknown, Set<string>>({
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
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      queryOptions?.enabled !== false &&
      !loading
    ),
    select: (data) => {
      const sourceMetadata = data.metadata.sources?.find(
        (item) => item.name === dataSource,
      );

      return new Set(
        sourceMetadata?.tables?.map(
          (item) => `${item.table.schema}.${item.table.name}`,
        ) ?? [],
      );
    },
  });

  return query;
}
