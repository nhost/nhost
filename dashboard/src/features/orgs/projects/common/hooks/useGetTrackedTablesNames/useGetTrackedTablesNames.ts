import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { isNotEmptyValue } from '@/lib/utils';

export interface UseGetTrackedTablesNamesOptions {
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
}: UseGetTrackedTablesNamesOptions) {
  return useExportMetadata((data) => {
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
  });
}
