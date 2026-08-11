import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { isEmptyValue } from '@/lib/utils';
import type {
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

export interface UseTableComputedFieldsQueryOptions {
  table: QualifiedTable;
  dataSource: string;
}

/**
 * Returns the computed fields configured for the given table from the
 * exported Hasura metadata. Returns an empty array when the table has no
 * computed fields configured.
 */
export default function useTableComputedFieldsQuery({
  table,
  dataSource,
}: UseTableComputedFieldsQueryOptions) {
  return useExportMetadata((data): ComputedFieldItem[] => {
    if (isEmptyValue(data.metadata.sources)) {
      return [];
    }

    const sourceMetadata = data.metadata.sources!.find(
      (item) => item.name === dataSource,
    );
    if (isEmptyValue(sourceMetadata?.tables)) {
      return [];
    }

    const tableMetadata = sourceMetadata!.tables!.find(
      (item) =>
        item.table.name === table.name && item.table.schema === table.schema,
    );

    return tableMetadata?.computed_fields ?? [];
  });
}
