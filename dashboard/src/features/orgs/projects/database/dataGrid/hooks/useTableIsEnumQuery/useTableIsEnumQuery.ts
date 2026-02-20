import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { isEmptyValue } from '@/lib/utils';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';

export interface UseTableIsEnumQueryOptions {
  table: QualifiedTable;
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
}: UseTableIsEnumQueryOptions) {
  return useExportMetadata((data): boolean => {
    if (isEmptyValue(data.metadata.sources)) {
      return false;
    }

    const sourceMetadata = data.metadata.sources!.find(
      (item) => item.name === dataSource,
    );
    if (isEmptyValue(sourceMetadata?.tables)) {
      return false;
    }

    const tableMetadata = sourceMetadata!.tables!.find(
      (item) =>
        item.table.name === table.name && item.table.schema === table.schema,
    );
    return Boolean(tableMetadata?.is_enum);
  });
}
