import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';

/**
 * This hook gets the data sources names from the metadata.
 *
 * @returns The result of the query.
 */
export default function useGetDataSources() {
  return useExportMetadata(
    (data) =>
      data.metadata?.sources?.reduce<string[]>((sourceNames, source) => {
        if (source.name) {
          sourceNames.push(source.name);
        }
        return sourceNames;
      }, []) ?? [],
  );
}
