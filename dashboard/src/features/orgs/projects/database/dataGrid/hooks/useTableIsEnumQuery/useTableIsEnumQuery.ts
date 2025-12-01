import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  ExportMetadataResponse,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

export interface UseTableIsEnumQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<ExportMetadataResponse, unknown, boolean>;
  /**
   * The table to get the enum status for.
   */
  table: QualifiedTable;
  /**
   * The data source to get the enum status for.
   */
  dataSource: string;
}

/**
 * This hook gets the enum status of a table from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns True if the table is an enum, false otherwise.
 */
export default function useTableIsEnumQuery({
  table,
  dataSource,
  queryOptions,
}: UseTableIsEnumQueryOptions) {
  const { project, loading } = useProject();

  const query = useQuery<ExportMetadataResponse, unknown, boolean>(
    ['export-metadata', project?.subdomain],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project?.config?.hasura.adminSecret!;

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
          return false;
        }

        const sourceMetadata = data.metadata.sources.find(
          (item) => item.name === dataSource,
        );
        if (!sourceMetadata?.tables) {
          return false;
        }

        const tableMetadata = sourceMetadata.tables.find(
          (item) =>
            item.table.name === table.name &&
            item.table.schema === table.schema,
        );
        return Boolean(tableMetadata?.is_enum);
      },
    },
  );

  return query;
}
