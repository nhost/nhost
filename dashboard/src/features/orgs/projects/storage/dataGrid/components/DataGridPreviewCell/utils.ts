import type { NhostClient } from '@nhost/nhost-js';

export interface GetFileUrlOrFallbackOptions {
  appClient: NhostClient;
  id: string;
  adminSecret: string;
  presignedUrlsEnabled?: boolean;
}

/**
 * Retrieves the presigned URL for a storage file if enabled.
 * If presigned URLs are disabled or the fetch fails, downloads the file as a Blob
 * using the Hasura admin secret and returns a local Object URL.
 */
export async function getFileUrlOrFallback({
  appClient,
  id,
  adminSecret,
  presignedUrlsEnabled = true,
}: GetFileUrlOrFallbackOptions): Promise<string> {
  if (presignedUrlsEnabled) {
    try {
      const { body } = await appClient.storage.getFilePresignedURL(id, {
        headers: {
          'x-hasura-admin-secret': adminSecret,
        },
      });

      if (body?.url) {
        return body.url;
      }
    } catch {
      // Fall through to fallback path if fetching presigned URL fails
    }
  }

  // Fallback: download the file as a Blob using the admin secret
  const { body: blob, status } = await appClient.storage.getFile(
    id,
    {},
    {
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
    },
  );

  if (status >= 400 || !blob) {
    throw new Error(`Storage returned status ${status}`);
  }

  return URL.createObjectURL(blob);
}
