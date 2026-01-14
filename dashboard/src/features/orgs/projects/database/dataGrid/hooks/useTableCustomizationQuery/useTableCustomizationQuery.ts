import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  ExportMetadataResponse,
  QualifiedTable,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

export interface UseTableCustomizationQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<
    ExportMetadataResponse,
    unknown,
    TableConfig | undefined
  >;
  /**
   * The table to get the customization for.
   */
  table: QualifiedTable;
  /**
   * The data source to get the customization for.
   */
  dataSource: string;
}

/**
 * This hook gets the table customization from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useTableCustomizationQuery({
  table,
  dataSource,
  queryOptions,
}: UseTableCustomizationQueryOptions) {
  const { project, loading } = useProject();

  const query = useQuery<
    ExportMetadataResponse,
    unknown,
    TableConfig | undefined
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
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        queryOptions?.enabled !== false &&
        !loading
      ),
      select: (data) => {
        if (!data.metadata.sources) {
          return undefined;
        }

        const sourceMetadata = data.metadata.sources.find(
          (item) => item.name === dataSource,
        );
        if (!sourceMetadata?.tables) {
          return undefined;
        }

        const tableMetadata = sourceMetadata.tables.find(
          (item) =>
            item.table.name === table.name &&
            item.table.schema === table.schema,
        );
        return tableMetadata?.configuration;
      },
    },
  );

  return query;
}
