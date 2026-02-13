import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export interface UseGetTrackedTablesNamesOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<ExportMetadataResponse, unknown, string[]>;
  /**
   * The data source to get the tracked tables names for.
   */
  dataSource: string;
}

/**
 * This hook gets the tracked tables names from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetTrackedTablesNames({
  dataSource,
  queryOptions,
}: UseGetTrackedTablesNamesOptions) {
  const { project, loading } = useProject();

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
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      queryOptions?.enabled !== false &&
      !loading
    ),
    select: (data) => {
      if (!data.metadata.sources) {
        return [];
      }

      const sourceMetadata = data.metadata.sources.find(
        (item) => item.name === dataSource,
      );
      if (!sourceMetadata?.tables) {
        return [];
      }

      return sourceMetadata.tables
        .map((item) => item.table.name)
        .filter(isNotEmptyValue);
    },
  });

  return query;
}
