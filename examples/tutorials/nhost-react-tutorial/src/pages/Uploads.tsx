import type { FileMetadata } from "@nhost/nhost-js/storage";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";


interface DeleteStatus {
  message: string;
  isError: boolean;
}


interface GraphqlGetFilesResponse {
  files: FileMetadata[];
}


function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const sizes: string[] = ["Bytes", "KB", "MB", "GB", "TB"];
  const i: number = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}


export default function Uploads(): JSX.Element {
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
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null);

  const fetchFiles = useCallback(async (): Promise<void> => {
    setIsFetching(true);
    setError(null);

    try {
      // Use GraphQL to fetch files from the storage system
      // Files are automatically filtered by user permissions
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
          response.body.errors[0]?.message || "Failed to fetch files",
        );
      }

      setFiles(response.body.data?.files || []);
    } catch (err) {
      console.error("Error fetching files:", err);
      setError("Failed to load files. Please try refreshing the page.");
    } finally {
      setIsFetching(false);
    }
  }, [nhost.graphql]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
    }
  }, [isAuthenticated, fetchFiles]);

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
      setError("Please select a file to upload");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload file to the personal bucket
      // The uploadedByUserId is automatically set by the storage permissions
      const response = await nhost.storage.uploadFiles({
        "bucket-id": "personal",
        "file[]": [selectedFile],
      });

      const uploadedFile = response.body.processedFiles?.[0];
      if (uploadedFile === undefined) {
        throw new Error("Failed to upload file");
      }
      setUploadResult(uploadedFile);

      // Clear the form
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Update the files list
      setFiles((prevFiles) => [uploadedFile, ...prevFiles]);

      await fetchFiles();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadResult(null);
      }, 3000);
    } catch (err: unknown) {
      const message = (err as Error).message || "An unknown error occurred";
      setError(`Failed to upload file: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleViewFile = async (
    fileId: string,
    fileName: string,
    mimeType: string,
  ): Promise<void> => {
    setViewingFile(fileId);

    try {
      // Get the file from storage
      const response = await nhost.storage.getFile(fileId);

      const url = URL.createObjectURL(response.body);

      // Handle different file types appropriately
      if (
        mimeType.startsWith("image/") ||
        mimeType === "application/pdf" ||
        mimeType.startsWith("text/") ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("audio/")
      ) {
        // Open viewable files in new tab
        window.open(url, "_blank");
      } else {
        // Download other file types
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show download confirmation
        const newWindow = window.open("", "_blank", "width=400,height=200");
        if (newWindow) {
          newWindow.document.documentElement.innerHTML = `
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
          `;
        }
      }
    } catch (err) {
      const message = (err as Error).message || "An unknown error occurred";
      setError(`Failed to view file: ${message}`);
      console.error("Error viewing file:", err);
    } finally {
      setViewingFile(null);
    }
  };

  const handleDeleteFile = async (fileId: string): Promise<void> => {
    if (!fileId || deleting) return;

    setDeleting(fileId);
    setError(null);
    setDeleteStatus(null);

    const fileToDelete = files.find((file) => file.id === fileId);
    const fileName = fileToDelete?.name || "File";

    try {
      // Delete file from storage
      // Permissions ensure users can only delete their own files
      await nhost.storage.deleteFile(fileId);

      setDeleteStatus({
        message: `${fileName} deleted successfully`,
        isError: false,
      });

      // Remove from local state
      setFiles(files.filter((file) => file.id !== fileId));

      await fetchFiles();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setDeleteStatus(null);
      }, 3000);
    } catch (err) {
      const message = (err as Error).message || "An unknown error occurred";
      setDeleteStatus({
        message: `Failed to delete ${fileName}: ${message}`,
        isError: true,
      });
      console.error("Error deleting file:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="container">
      <header className="container-header">
        <h1 className="todos-title">File Upload</h1>
      </header>

      <div className="form-card">
        <h2 className="form-title">Upload a File</h2>

        <div className="field-group">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              border: 0,
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            className="btn btn-secondary file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
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
              <p className="file-upload-info">
                {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {uploadResult && (
          <div className="success-message">File uploaded successfully!</div>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="btn btn-primary"
          style={{ width: "100%" }}
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>

      <div className="form-card">
        <h2 className="form-title">Your Files</h2>

        {deleteStatus && (
          <div className={deleteStatus.isError ? "error-message" : "success-message"}>
            {deleteStatus.message}
          </div>
        )}

        {isFetching ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="spinner"></div>
              <span className="loading-text">Loading files...</span>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <svg
              className="empty-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <h3 className="empty-title">No files yet</h3>
            <p className="empty-description">Upload your first file to get started!</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="file-table">
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
                    <td className="file-name">{file.name}</td>
                    <td className="file-meta">{file.mimeType}</td>
                    <td className="file-meta">{formatFileSize(file.size || 0)}</td>
                    <td>
                      <div className="file-actions">
                        <button
                          type="button"
                          onClick={() =>
                            handleViewFile(
                              file.id || "unknown",
                              file.name || "unknown",
                              file.mimeType || "unknown",
                            )
                          }
                          disabled={viewingFile === file.id}
                          className="action-btn action-btn-edit"
                          title="View File"
                        >
                          {viewingFile === file.id ? "⏳" : "👁️"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file.id || "unknown")}
                          disabled={deleting === file.id}
                          className="action-btn action-btn-delete"
                          title="Delete File"
                        >
                          {deleting === file.id ? "⏳" : "🗑️"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
