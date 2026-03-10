import {
  type UseExportMetadataOptions,
  useExportMetadata,
} from '@/features/orgs/projects/common/hooks/useExportMetadata';

export interface UseGetTrackedFunctionsSetOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseExportMetadataOptions;
  /**
   * The data source to get the tracked functions names for.
   */
  dataSource: string;
}

/**
 * This hook gets the tracked functions for a data source as a Set of
 * "schema.name" qualified strings. The Set is constructed once per fetch
 * and memoized by React Query until the underlying data changes.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetTrackedFunctionsSet({
  dataSource,
  queryOptions,
}: UseGetTrackedFunctionsSetOptions) {
  return useExportMetadata((data) => {
    const sourceMetadata = data.metadata.sources?.find(
      (item) => item.name === dataSource,
    );

    return new Set(
      sourceMetadata?.functions?.map(
        (item) => `${item.function.schema}.${item.function.name}`,
      ) ?? [],
    );
  }, queryOptions);
}
