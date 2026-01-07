import type { FileMetadata } from '@nhost/nhost-js/storage';
import { createNhostClient } from '../lib/nhost/server';
import UploadClient from './client';

interface GetFilesResponse {
  files: FileMetadata[];
}

export default async function UploadPage() {
  // Create the server client with async cookie access
  const nhost = await createNhostClient();

  // Fetch files on the server
  let files: FileMetadata[] = [];
  let error: string | null = null;

  try {
    const response = await nhost.graphql.request<GetFilesResponse>({
      query: `
        query GetFiles {
          files {
            id
            name
            size
            mimeType
            bucketId
            uploadedByUserId
          }
        }
      `,
    });

    if (response.body.errors) {
      throw new Error(response.body.errors[0]?.message);
    }

    files = response.body.data?.files || [];
  } catch (err) {
    error = `Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error('Error fetching files:', err);
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl mb-6 gradient-text">File Upload</h1>

      {/* Pass the server-fetched files to the client component */}
      <UploadClient initialFiles={files} serverError={error} />
    </div>
  );
}
