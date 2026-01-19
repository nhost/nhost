import type { FileMetadata } from '@nhost/nhost-js/storage';
import { createNhostClient } from '../../lib/nhost/server';
import FilesClient from './FilesClient';

interface GetFilesResponse {
  files: FileMetadata[];
}

export default async function FilesPage() {
  const nhost = await createNhostClient();

  // Fetch files on the server
  let files: FileMetadata[] = [];
  let error: string | null = null;

  try {
    // Use GraphQL to fetch files from the storage system
    // Files are automatically filtered by user permissions
    const response = await nhost.graphql.request<GetFilesResponse>({
      query: `query GetFiles {
          files {
            id
            name
            size
            mimeType
            bucketId
            uploadedByUserId
          }
        }`,
    });

    if (response.body.errors) {
      throw new Error(
        response.body.errors[0]?.message || 'Failed to fetch files',
      );
    }

    files = response.body.data?.files || [];
  } catch (err) {
    error = `Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error('Error fetching files:', err);
  }

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="page-title">File Upload</h1>
      </header>

      {/* Pass the server-fetched files to the client component */}
      <FilesClient initialFiles={files} serverError={error} />
    </div>
  );
}
