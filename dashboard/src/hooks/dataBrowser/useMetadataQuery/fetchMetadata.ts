import type {
  HasuraMetadata,
  HasuraMetadataSource,
  MutationOrQueryBaseOptions,
  QueryError,
} from '@/types/dataBrowser';
import fetch from 'cross-fetch';

export interface FetchMetadataOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}
export interface FetchMetadataReturnType extends HasuraMetadataSource {}

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

  const responseData: Record<string, HasuraMetadata> | QueryError =
    await response.json();

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

  const { metadata } = responseData;

  return (
    metadata?.sources?.find((source) => source.name === dataSource) || null
  );
}
