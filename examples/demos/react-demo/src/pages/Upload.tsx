import type { FetchError } from '@nhost/nhost-js/fetch';
import type { ErrorResponse, FileMetadata } from '@nhost/nhost-js/storage';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';
import { formatFileSize } from '../lib/utils';

interface StatusMessage {
  message: string;
  isError: boolean;
}

interface GraphqlGetFilesResponse {
  files: FileMetadata[];
}

export default function Upload(): JSX.Element {
  const { isAuthenticated, nhost } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<FileMetadata | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  );
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const fetchFiles = useCallback(async (): Promise<void> => {
    setIsFetching(true);
    setError(null);

    try {
      // Fetch files using GraphQL query
      const response = await nhost.graphql.request<GraphqlGetFilesResponse>({
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

      setFiles(response.body.data?.files || []);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Failed to load files. Please try refreshing the page.');
    } finally {
      setIsFetching(false);
    }
  }, [nhost.graphql]);

  // Fetch existing files when component mounts
  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
    }
  }, [isAuthenticated, fetchFiles]);

  // ProtectedRoute component now handles authentication check
  // We can just focus on the component logic here

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file) {
        setSelectedFile(file);
        setError(null);
        setUploadResult(null);
      }
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload file using Nhost storage
      const response = await nhost.storage.uploadFiles({
        'bucket-id': 'default',
        'file[]': [selectedFile],
      });

      // Get the processed file data
      const uploadedFile = response.body.processedFiles?.[0];
      if (uploadedFile === undefined) {
        throw new Error('Failed to upload file');
      }
      setUploadResult(uploadedFile);

      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setFiles((prevFiles) => [uploadedFile, ...prevFiles]);

      // Refresh file list
      await fetchFiles();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadResult(null);
      }, 3000);
    } catch (err: unknown) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Failed to upload file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Function to handle viewing a file with proper authorization
  const handleViewFile = async (
    fileId: string,
    fileName: string,
    mimeType: string,
  ): Promise<void> => {
    setViewingFile(fileId);

    try {
      // Fetch the file with authentication using the SDK
      const response = await nhost.storage.getFile(fileId);

      // Create a URL for the blob
      const url = URL.createObjectURL(response.body);

      // Handle different file types appropriately
      if (
        mimeType.startsWith('image/') ||
        mimeType === 'application/pdf' ||
        mimeType.startsWith('text/') ||
        mimeType.startsWith('video/') ||
        mimeType.startsWith('audio/')
      ) {
        // For media types that browsers can display natively, just open in a new tab
        window.open(url, '_blank');
      } else {
        // For other file types, trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Optional: Open a small window to inform the user about the download
        const newWindow = window.open('', '_blank', 'width=400,height=200');
        if (newWindow) {
          newWindow.document.write(`
            <html>
            <head>
              <title>File Download</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
              </style>
            </head>
            <body>
              <h3>Downloading: ${fileName}</h3>
              <p>Your download has started. You can close this window.</p>
            </body>
            </html>
          `);
          newWindow.document.close();
        }
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Failed to view file: ${error.message}`);
      console.error('Error viewing file:', err);
    } finally {
      setViewingFile(null);
    }
  };

  // Function to handle deleting a file
  const handleDeleteFile = async (fileId: string): Promise<void> => {
    if (!fileId || deleting) return;

    setDeleting(fileId);
    setError(null);
    setStatusMessage(null);

    // Get the file name for the status message
    const fileToDelete = files.find((file) => file.id === fileId);
    const fileName = fileToDelete?.name || 'File';

    try {
      // Delete the file using the Nhost storage SDK
      await nhost.storage.deleteFile(fileId);

      // Show success message
      setStatusMessage({
        message: `${fileName} deleted successfully`,
        isError: false,
      });

      // Update the local files list by removing the deleted file
      setFiles(files.filter((file) => file.id !== fileId));

      // Refresh the file list
      await fetchFiles();

      // Clear the success message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (err) {
      // Show error message
      const error = err as FetchError<ErrorResponse>;
      setStatusMessage({
        message: `Failed to delete ${fileName}: ${error.message}`,
        isError: true,
      });
      console.error('Error deleting file:', err);
    } finally {
      setDeleting(null);
    }
  };

  // Function to handle replacing a file
  const handleReplaceFile = async (
    fileId: string,
    newFile: File,
  ): Promise<void> => {
    setReplacing(fileId);
    setStatusMessage(null);

    try {
      await nhost.storage.replaceFile(fileId, { file: newFile });

      setStatusMessage({
        message: 'File replaced successfully',
        isError: false,
      });

      await fetchFiles();

      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setStatusMessage({
        message: `Failed to replace file: ${error.message}`,
        isError: true,
      });
    } finally {
      setReplacing(null);
    }
  };

  // Function to get a pre-signed URL for sharing
  const handleGetPresignedUrl = async (fileId: string): Promise<void> => {
    try {
      const { body } = await nhost.storage.getFilePresignedURL(fileId);
      setPresignedUrl(body.url);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setStatusMessage({
        message: `Failed to get pre-signed URL: ${error.message}`,
        isError: true,
      });
    }
  };

  // Load image thumbnails using image transformation
  const loadThumbnail = useCallback(
    async (fileId: string): Promise<void> => {
      try {
        const { body } = await nhost.storage.getFile(fileId, {
          w: 100,
          h: 100,
          f: 'webp',
        });
        const url = URL.createObjectURL(body);
        setThumbnails((prev) => ({ ...prev, [fileId]: url }));
      } catch {
        // Silently skip thumbnails that fail to load
      }
    },
    [nhost.storage],
  );

  // Load thumbnails for image files
  useEffect(() => {
    for (const file of files) {
      if (
        file.mimeType?.startsWith('image/') &&
        file.id &&
        !thumbnails[file.id]
      ) {
        loadThumbnail(file.id);
      }
    }
  }, [files, thumbnails, loadThumbnail]);

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl mb-6 gradient-text">File Upload</h1>

      {/* Upload Form */}
      <div className="glass-card p-8 mb-6">
        <h2 className="text-2xl mb-4">Upload a File</h2>

        <div className="mb-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              border: 0,
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            className="file-upload"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              className="text-sm mb-2"
              width="40"
              height="40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="Upload file"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p>Click to select a file</p>
            {selectedFile && (
              <p
                style={{
                  color: 'var(--primary)',
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                }}
              >
                {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {uploadResult && (
          <div className="alert alert-success">File uploaded successfully!</div>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="btn btn-primary w-full"
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
      </div>

      {/* Files List */}
      <div className="glass-card p-8">
        <h2 className="text-2xl mb-6">Your Files</h2>

        {statusMessage && (
          <div
            className={`alert ${statusMessage.isError ? 'alert-error' : 'alert-success'} mb-4`}
          >
            {statusMessage.message}
          </div>
        )}

        {isFetching ? (
          <p className="text-center">Loading files...</p>
        ) : files.length === 0 ? (
          <p className="text-center">No files uploaded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {file.mimeType?.startsWith('image/') &&
                          file.id &&
                          thumbnails[file.id] && (
                            <img
                              src={thumbnails[file.id]}
                              alt={file.name || ''}
                              style={{
                                width: 32,
                                height: 32,
                                objectFit: 'cover',
                                borderRadius: 4,
                              }}
                            />
                          )}
                        {file.name}
                      </div>
                    </td>
                    <td>{file.mimeType}</td>
                    <td>{formatFileSize(file.size || 0)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            handleViewFile(
                              file.id || 'unknown',
                              file.name || 'unknown',
                              file.mimeType || 'unknown',
                            )
                          }
                          disabled={viewingFile === file.id}
                          className="action-icon action-icon-view"
                          title="View File"
                        >
                          {viewingFile === file.id ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="Loading"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="View file"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            replaceInputRef.current?.setAttribute(
                              'data-file-id',
                              file.id || '',
                            );
                            replaceInputRef.current?.click();
                          }}
                          disabled={replacing === file.id}
                          className="action-icon action-icon-view"
                          title="Replace File"
                        >
                          {replacing === file.id ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="Replacing"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="Replace file"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleGetPresignedUrl(file.id || 'unknown')
                          }
                          className="action-icon action-icon-view"
                          title="Get Share Link"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            role="img"
                            aria-label="Share file"
                          >
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file.id || 'unknown')}
                          disabled={deleting === file.id}
                          className="action-icon action-icon-delete"
                          title="Delete File"
                        >
                          {deleting === file.id ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="Deleting"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="Delete file"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Hidden file input for replace */}
        <input
          type="file"
          ref={replaceInputRef}
          onChange={(e) => {
            const newFile = e.target.files?.[0];
            const fileId =
              replaceInputRef.current?.getAttribute('data-file-id');
            if (newFile && fileId) {
              handleReplaceFile(fileId, newFile);
            }
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />

        {/* Pre-signed URL display */}
        {presignedUrl && (
          <div className="glass-card p-4 mt-4">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}
            >
              <strong>Pre-signed URL</strong>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPresignedUrl(null)}
              >
                Close
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={presignedUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
