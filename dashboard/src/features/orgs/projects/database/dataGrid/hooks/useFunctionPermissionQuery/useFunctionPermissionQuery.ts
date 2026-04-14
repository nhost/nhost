import {
  type UseExportMetadataOptions,
  useExportMetadata,
} from '@/features/orgs/projects/common/hooks/useExportMetadata';

export interface UseFunctionPermissionQueryOptions {
  /**
   * The schema where the function is located.
   */
  schema: string;
  /**
   * The function name.
   */
  functionName: string;
  /**
   * The data source name.
   */
  dataSource: string;
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseExportMetadataOptions;
}

/**
 * Hook to fetch function permissions from metadata.
 * Returns the permissions array for a specific function.
 */
export default function useFunctionPermissionQuery({
  schema,
  functionName,
  dataSource,
  queryOptions,
}: UseFunctionPermissionQueryOptions) {
  return useExportMetadata((data) => {
    const sourceMetadata = data.metadata.sources?.find(
      (item) => item.name === dataSource,
    );

    const functionMetadata = sourceMetadata?.functions?.find(
      (fn) =>
        fn.function?.name === functionName && fn.function?.schema === schema,
    );

    return functionMetadata?.permissions ?? [];
  }, queryOptions);
}
