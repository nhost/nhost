import { useMemo } from 'react';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type { ExportMetadataResponseMetadataSourcesItemFunctionsItemPermissionsItem } from '@/utils/hasura-api/generated/schemas';

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
  {
    schema,
    functionName,
    dataSource = 'default',
  }: UseFunctionPermissionQueryOptions,
) {
  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
    refetch,
  } = useMetadataQuery([`${dataSource}.metadata`]);

  const data = useMemo<UseFunctionPermissionQueryResult | undefined>(() => {
    if (metadataStatus !== 'success' || !metadata) {
      return undefined;
    }

    const resourceVersion = metadata.resourceVersion ?? 0;
    const functions = metadata.functions ?? [];

    const functionMetadata = functions.find(
      (fn) =>
        fn.function?.name === functionName && fn.function?.schema === schema,
    );

    const permissions: FunctionPermission[] =
      functionMetadata?.permissions ?? [];

    return {
      permissions,
      resourceVersion,
      isTracked: !!functionMetadata,
    };
  }, [metadata, metadataStatus, functionName, schema]);

  return {
    data,
    status: metadataStatus,
    error: metadataError,
    refetch,
  };
}

export { useFunctionPermissionQuery };
