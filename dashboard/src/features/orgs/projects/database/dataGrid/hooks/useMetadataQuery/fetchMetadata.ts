import type {
  HasuraMetadata,
  HasuraMetadataSource,
  MutationOrQueryBaseOptions,
  QueryError,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface FetchMetadataOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}
export interface FetchMetadataReturnType extends Partial<HasuraMetadataSource> {
  /**
   * The resource version of the metadata.
   */
  resourceVersion: number;
}

/**
 * Fetch Hasura metadata using the Metadata API.
 *
 * @param options - Options to use for the fetch call.
 * @returns Hasura metadata.
 */
export default async function fetchMetadata({
  dataSource,
  appUrl,
  adminSecret,
}: FetchMetadataOptions): Promise<FetchMetadataReturnType> {
  const response = await fetch(`${appUrl}/v1/metadata`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      type: 'export_metadata',
      version: 2,
      args: {},
    }),
  });

  const responseData:
    | { metadata: HasuraMetadata; resource_version: number }
    | QueryError = await response.json();

  if (!response.ok || 'error' in responseData) {
    if ('internal' in responseData) {
      const queryError = responseData as QueryError;
      throw new Error(queryError.internal.error.message);
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      throw new Error(queryError.error);
    }
  }

  const { metadata, resource_version: resourceVersion } = responseData;
  const currentSource =
    metadata?.sources?.find((source) => source.name === dataSource) || null;

  return currentSource
    ? { ...currentSource, resourceVersion }
    : { resourceVersion };
}
