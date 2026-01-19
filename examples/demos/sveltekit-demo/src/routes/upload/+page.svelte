<script lang="ts">
import type { FetchError } from '@nhost/nhost-js/fetch';
import type { ErrorResponse, FileMetadata } from '@nhost/nhost-js/storage';
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { auth, nhost } from '$lib/nhost/auth';
import { formatFileSize } from '$lib/utils';

interface DeleteStatus {
  message: string;
  isError: boolean;
}

interface GraphqlGetFilesResponse {
  files: FileMetadata[];
}

let fileInputRef = $state<HTMLInputElement>();
let selectedFile: File | null = $state(null);
let uploading = $state(false);
let uploadResult: FileMetadata | null = $state(null);
let isFetching = $state(false);
let error: string | null = $state(null);
let files = $state<FileMetadata[]>([]);
let viewingFile: string | null = $state(null);
let deleting: string | null = $state(null);
let deleteStatus: DeleteStatus | null = $state(null);

// Redirect if not authenticated
$effect(() => {
  if (!$auth.isLoading && !$auth.isAuthenticated) {
    void goto('/signin');
  }
});

// Load files when authentication is resolved
$effect(() => {
  if (
    !$auth.isLoading &&
    $auth.isAuthenticated &&
    files.length === 0 &&
    !isFetching
  ) {
    void fetchFiles();
  }
});

async function fetchFiles() {
  isFetching = true;
  error = null;

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

    files = response.body.data?.files || [];
  } catch (err) {
    console.error('Error fetching files:', err);
    error = 'Failed to load files. Please try refreshing the page.';
  } finally {
    isFetching = false;
  }
}

// Fetch existing files when component mounts
onMount(() => {
  if ($auth.isAuthenticated) {
    void fetchFiles();
  }
});

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (file) {
      selectedFile = file;
      error = null;
      uploadResult = null;
    }
  }
}

async function handleUpload() {
  if (!selectedFile) {
    error = 'Please select a file to upload';
    return;
  }

  uploading = true;
  error = null;

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
    uploadResult = uploadedFile;

    // Reset form
    selectedFile = null;
    if (fileInputRef) {
      fileInputRef.value = '';
    }

    files = [uploadedFile, ...files];

    // Refresh file list
    await fetchFiles();

    // Clear success message after 3 seconds
    setTimeout(() => {
      uploadResult = null;
    }, 3000);
  } catch (err: unknown) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `Failed to upload file: ${fetchError.message}`;
  } finally {
    uploading = false;
  }
}

// Function to handle viewing a file with proper authorization
async function handleViewFile(
  fileId: string,
  fileName: string,
  mimeType: string,
) {
  viewingFile = fileId;

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
    const fetchError = err as FetchError<ErrorResponse>;
    error = `Failed to view file: ${fetchError.message}`;
    console.error('Error viewing file:', err);
  } finally {
    viewingFile = null;
  }
}

// Function to handle deleting a file
async function handleDeleteFile(fileId: string) {
  if (!fileId || deleting) return;

  deleting = fileId;
  error = null;
  deleteStatus = null;

  // Get the file name for the status message
  const fileToDelete = files.find((file) => file.id === fileId);
  const fileName = fileToDelete?.name || 'File';

  try {
    // Delete the file using the Nhost storage SDK
    await nhost.storage.deleteFile(fileId);

    // Show success message
    deleteStatus = {
      message: `${fileName} deleted successfully`,
      isError: false,
    };

    // Update the local files list by removing the deleted file
    files = files.filter((file) => file.id !== fileId);

    // Refresh the file list
    await fetchFiles();

    // Clear the success message after 3 seconds
    setTimeout(() => {
      deleteStatus = null;
    }, 3000);
  } catch (err) {
    // Show error message
    const fetchError = err as FetchError<ErrorResponse>;
    deleteStatus = {
      message: `Failed to delete ${fileName}: ${fetchError.message}`,
      isError: true,
    };
    console.error('Error deleting file:', err);
  } finally {
    deleting = null;
  }
}

function handleFileUploadClick() {
  fileInputRef?.click();
}
</script>

{#if $auth.isLoading}
  <div class="loading-container">Loading...</div>
{:else if $auth.isAuthenticated}
  <div class="flex flex-col">
    <h1 class="text-3xl mb-6 gradient-text">File Upload</h1>

    <!-- Upload Form -->
    <div class="glass-card p-8 mb-6">
      <h2 class="text-2xl mb-4">Upload a File</h2>

      <div class="mb-6">
        <input
          type="file"
          bind:this={fileInputRef}
          onchange={handleFileChange}
          style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;"
          aria-hidden="true"
          tabindex="-1"
        />
        <div
          class="file-upload"
          onclick={handleFileUploadClick}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && handleFileUploadClick()}
        >
          <svg
            class="text-sm mb-2"
            width="40"
            height="40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p>Click to select a file</p>
          {#if selectedFile}
            <p
              style="color: var(--primary); margin-top: 0.5rem; font-size: 0.875rem;"
            >
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          {/if}
        </div>
      </div>

      {#if error}
        <div class="alert alert-error">{error}</div>
      {/if}

      {#if uploadResult}
        <div class="alert alert-success">File uploaded successfully!</div>
      {/if}

      <button
        onclick={handleUpload}
        disabled={!selectedFile || uploading}
        class="btn btn-primary w-full"
      >
        {uploading ? "Uploading..." : "Upload File"}
      </button>
    </div>

    <!-- Files List -->
    <div class="glass-card p-8">
      <h2 class="text-2xl mb-6">Your Files</h2>

      {#if deleteStatus}
        <div
          class="alert {deleteStatus.isError
            ? 'alert-error'
            : 'alert-success'} mb-4"
        >
          {deleteStatus.message}
        </div>
      {/if}

      {#if isFetching}
        <p class="text-center">Loading files...</p>
      {:else if files.length === 0}
        <p class="text-center">No files uploaded yet.</p>
      {:else}
        <div style="overflow-x: auto;">
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
              {#each files as file (file.id)}
                <tr>
                  <td>{file.name}</td>
                  <td>{file.mimeType}</td>
                  <td>{formatFileSize(file.size || 0)}</td>
                  <td>
                    <div class="table-actions">
                      <button
                        onclick={() =>
                          handleViewFile(
                            file.id || "unknown",
                            file.name || "unknown",
                            file.mimeType || "unknown",
                          )}
                        disabled={viewingFile === file.id}
                        class="action-icon action-icon-view"
                        title="View File"
                      >
                        {#if viewingFile === file.id}
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6" />
                          </svg>
                        {:else}
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                            />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        {/if}
                      </button>
                      <button
                        onclick={() => handleDeleteFile(file.id || "unknown")}
                        disabled={deleting === file.id}
                        class="action-icon action-icon-delete"
                        title="Delete File"
                      >
                        {#if deleting === file.id}
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6" />
                          </svg>
                        {:else}
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path
                              d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                            />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        {/if}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="text-center">
    <h2 class="text-xl mb-4">Access Denied</h2>
    <p>You must be signed in to access file uploads.</p>
  </div>
{/if}
