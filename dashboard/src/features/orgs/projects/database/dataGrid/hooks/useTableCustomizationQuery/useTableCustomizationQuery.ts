import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type {
  QualifiedTable,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';

export interface UseTableCustomizationQueryOptions {
  table: QualifiedTable;
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
}: UseTableCustomizationQueryOptions) {
  return useExportMetadata((data): TableConfig | undefined => {
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
        item.table.name === table.name && item.table.schema === table.schema,
    );
    return tableMetadata?.configuration;
  });
}
