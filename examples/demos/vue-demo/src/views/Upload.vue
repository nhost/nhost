<template>
  <div class="flex flex-col">
    <h1 class="text-3xl mb-6 gradient-text">File Upload</h1>

    <!-- Upload Form -->
    <div class="glass-card p-8 mb-6">
      <h2 class="text-2xl mb-4">Upload a File</h2>

      <div class="mb-6">
        <input
          type="file"
          ref="fileInputRef"
          @change="handleFileChange"
          style="
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
          "
          aria-hidden="true"
          tabindex="-1"
        />
        <div class="file-upload" @click="() => fileInputRef?.click()">
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
          <p
            v-if="selectedFile"
            style="
              color: var(--primary);
              margin-top: 0.5rem;
              font-size: 0.875rem;
            "
          >
            {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
          </p>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div v-if="uploadResult" class="alert alert-success">
        File uploaded successfully!
      </div>

      <button
        @click="handleUpload"
        :disabled="!selectedFile || uploading"
        class="btn btn-primary w-full"
      >
        {{ uploading ? "Uploading..." : "Upload File" }}
      </button>
    </div>

    <!-- Files List -->
    <div class="glass-card p-8">
      <h2 class="text-2xl mb-6">Your Files</h2>

      <div
        v-if="deleteStatus"
        :class="`alert ${deleteStatus.isError ? 'alert-error' : 'alert-success'} mb-4`"
      >
        {{ deleteStatus.message }}
      </div>

      <p v-if="isFetching" class="text-center">Loading files...</p>
      <p v-else-if="files.length === 0" class="text-center">
        No files uploaded yet.
      </p>
      <div v-else style="overflow-x: auto">
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
            <tr v-for="file in files" :key="file.id">
              <td>{{ file.name }}</td>
              <td>{{ file.mimeType }}</td>
              <td>{{ formatFileSize(file.size || 0) }}</td>
              <td>
                <div class="table-actions">
                  <button
                    @click="
                      () =>
                        handleViewFile(
                          file.id || 'unknown',
                          file.name || 'unknown',
                          file.mimeType || 'unknown',
                        )
                    "
                    :disabled="viewingFile === file.id"
                    class="action-icon action-icon-view"
                    title="View File"
                  >
                    <svg
                      v-if="viewingFile === file.id"
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
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    @click="() => handleDeleteFile(file.id || 'unknown')"
                    :disabled="deleting === file.id"
                    class="action-icon action-icon-delete"
                    title="Delete File"
                  >
                    <svg
                      v-if="deleting === file.id"
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
                    <svg
                      v-else
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
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type FetchError } from '@nhost/nhost-js/fetch';
import type { ErrorResponse, FileMetadata } from '@nhost/nhost-js/storage';
import { onMounted, ref } from 'vue';
import { useAuth } from '../lib/nhost/auth';
import { formatFileSize } from '../lib/utils';

interface DeleteStatus {
  message: string;
  isError: boolean;
}

interface GraphqlGetFilesResponse {
  files: FileMetadata[];
}

const { isAuthenticated, nhost } = useAuth();
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const uploading = ref<boolean>(false);
const uploadResult = ref<FileMetadata | null>(null);
const isFetching = ref<boolean>(true);
const error = ref<string | null>(null);
const files = ref<FileMetadata[]>([]);
const viewingFile = ref<string | null>(null);
const deleting = ref<string | null>(null);
const deleteStatus = ref<DeleteStatus | null>(null);

const fetchFiles = async (): Promise<void> => {
  isFetching.value = true;
  error.value = null;

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

    files.value = response.body.data?.files || [];
  } catch (err) {
    console.error('Error fetching files:', err);
    error.value = 'Failed to load files. Please try refreshing the page.';
  } finally {
    isFetching.value = false;
  }
};

// Fetch existing files when component mounts
onMounted(() => {
  if (isAuthenticated.value) {
    fetchFiles();
  }
});

const handleFileChange = (e: Event): void => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (file) {
      selectedFile.value = file;
      error.value = null;
      uploadResult.value = null;
    }
  }
};

const handleUpload = async (): Promise<void> => {
  if (!selectedFile.value) {
    error.value = 'Please select a file to upload';
    return;
  }

  uploading.value = true;
  error.value = null;

  try {
    // Upload file using Nhost storage
    const response = await nhost.storage.uploadFiles({
      'bucket-id': 'default',
      'file[]': [selectedFile.value],
    });

    // Get the processed file data
    const uploadedFile = response.body.processedFiles?.[0];
    if (uploadedFile === undefined) {
      throw new Error('Failed to upload file');
    }
    uploadResult.value = uploadedFile;

    // Reset form
    selectedFile.value = null;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }

    files.value = [uploadedFile, ...files.value];

    // Refresh file list
    await fetchFiles();

    // Clear success message after 3 seconds
    setTimeout(() => {
      uploadResult.value = null;
    }, 3000);
  } catch (err: unknown) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `Failed to upload file: ${errorObj.message}`;
  } finally {
    uploading.value = false;
  }
};

// Function to handle viewing a file with proper authorization
const handleViewFile = async (
  fileId: string,
  fileName: string,
  mimeType: string,
): Promise<void> => {
  viewingFile.value = fileId;

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
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `Failed to view file: ${errorObj.message}`;
    console.error('Error viewing file:', err);
  } finally {
    viewingFile.value = null;
  }
};

// Function to handle deleting a file
const handleDeleteFile = async (fileId: string): Promise<void> => {
  if (!fileId || deleting.value) return;

  deleting.value = fileId;
  error.value = null;
  deleteStatus.value = null;

  // Get the file name for the status message
  const fileToDelete = files.value.find((file) => file.id === fileId);
  const fileName = fileToDelete?.name || 'File';

  try {
    // Delete the file using the Nhost storage SDK
    await nhost.storage.deleteFile(fileId);

    // Show success message
    deleteStatus.value = {
      message: `${fileName} deleted successfully`,
      isError: false,
    };

    // Update the local files list by removing the deleted file
    files.value = files.value.filter((file) => file.id !== fileId);

    // Refresh the file list
    await fetchFiles();

    // Clear the success message after 3 seconds
    setTimeout(() => {
      deleteStatus.value = null;
    }, 3000);
  } catch (err) {
    // Show error message
    const errorObj = err as FetchError<ErrorResponse>;
    deleteStatus.value = {
      message: `Failed to delete ${fileName}: ${errorObj.message}`,
      isError: true,
    };
    console.error('Error deleting file:', err);
  } finally {
    deleting.value = null;
  }
};
</script>
