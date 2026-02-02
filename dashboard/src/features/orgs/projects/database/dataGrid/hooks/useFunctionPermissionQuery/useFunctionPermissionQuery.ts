import { useMemo } from 'react';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type {
  ExportMetadataResponseMetadataSourcesItemFunctionsItem,
  ExportMetadataResponseMetadataSourcesItemFunctionsItemPermissionsItem,
} from '@/utils/hasura-api/generated/schemas';

export type FunctionPermission =
  ExportMetadataResponseMetadataSourcesItemFunctionsItemPermissionsItem;

export interface UseFunctionPermissionQueryResult {
  /**
   * Array of permissions for the function.
   */
  permissions: FunctionPermission[];
  /**
   * The resource version of the metadata.
   */
  resourceVersion: number;
  /**
   * Whether the function is tracked in Hasura.
   */
  isTracked: boolean;
}

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
  dataSource?: string;
}

/**
 * Hook to fetch function permissions from Hasura metadata.
 * Returns the permissions array for a specific function and the resource version.
 * This hook derives data directly from useMetadataQuery to ensure it stays in sync.
 */
export default function useFunctionPermissionQuery(
  _queryKey: unknown,
  { schema, functionName, dataSource = 'default' }: UseFunctionPermissionQueryOptions,
) {
  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
    refetch,
  } = useMetadataQuery([`${dataSource}.metadata`]);

  // Type the metadata with the functions property from Orval-generated types
  const metadataWithFunctions = metadata as
    | (typeof metadata & {
        functions?: ExportMetadataResponseMetadataSourcesItemFunctionsItem[];
      })
    | undefined;

  // Derive function permission data from metadata
  const data = useMemo<UseFunctionPermissionQueryResult | undefined>(() => {
    if (metadataStatus !== 'success' || !metadataWithFunctions) {
      return undefined;
    }

    const resourceVersion = metadataWithFunctions.resourceVersion ?? 0;
    const functions = metadataWithFunctions.functions ?? [];

    // Find the function in the metadata
    const functionMetadata = functions.find(
      (fn) =>
        fn.function?.name === functionName && fn.function?.schema === schema,
    );

    // Extract permissions from the function metadata
    const permissions: FunctionPermission[] =
      functionMetadata?.permissions ?? [];

    return {
      permissions,
      resourceVersion,
      isTracked: !!functionMetadata,
    };
  }, [metadataWithFunctions, metadataStatus, functionName, schema]);

  return {
    data,
    status: metadataStatus,
    error: metadataError,
    refetch,
  };
}

export { useFunctionPermissionQuery };
