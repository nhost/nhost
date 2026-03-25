import {
  type UseExportMetadataOptions,
  useExportMetadata,
} from '@/features/orgs/projects/common/hooks/useExportMetadata';

export interface UseGetEnumsSetOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseExportMetadataOptions;
  /**
   * The data source to get the enum tables for.
   */
  dataSource: string;
}

/**
 * This hook gets the enum tables for a data source as a Set of
 * "schema.name" qualified strings. The Set is constructed once per fetch
 * and memoized by React Query until the underlying data changes.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetEnumsSet({
  dataSource,
  queryOptions,
}: UseGetEnumsSetOptions) {
  return useExportMetadata((data) => {
    const sourceMetadata = data.metadata.sources?.find(
      (item) => item.name === dataSource,
    );

    return new Set(
      sourceMetadata?.tables
        ?.filter((item) => item.is_enum)
        .map((item) => `${item.table.schema}.${item.table.name}`) ?? [],
    );
  }, queryOptions);
}
