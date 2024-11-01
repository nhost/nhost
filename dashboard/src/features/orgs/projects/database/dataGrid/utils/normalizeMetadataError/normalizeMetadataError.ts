import type { MetadataError } from '@/features/database/dataGrid/types/dataBrowser';

/**
 * Returns a normalized error message from a metadata error.
 *
 * @param responseData The response data from a Hasura metadata change.
 * @returns The normalized error message.
 */
export default function normalizeMetadataError(responseData: any): string {
  const unknownErrorMessage = 'Unknown error occurred.';

  if ('error' in responseData && 'internal' in responseData) {
    const metadataError = responseData as MetadataError;

    return metadataError.internal[0]?.reason || unknownErrorMessage;
  }

  if ('error' in responseData) {
    const metadataError = responseData as MetadataError;

    return metadataError.error || unknownErrorMessage;
  }

  return unknownErrorMessage;
}
