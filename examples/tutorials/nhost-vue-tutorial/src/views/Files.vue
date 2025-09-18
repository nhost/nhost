<template>
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">File Upload</h1>
    </header>

    <div class="form-card">
      <h2 class="form-title">Upload a File</h2>

      <div class="field-group">
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
        <button
          type="button"
          class="btn btn-secondary file-upload-btn"
          @click="() => fileInputRef?.click()"
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
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p>Click to select a file</p>
          <p
            v-if="selectedFile"
            class="file-upload-info"
          >
            {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
          </p>
        </button>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>

      <div v-if="uploadResult" class="success-message">
        File uploaded successfully!
      </div>

      <button
        type="button"
        @click="handleUpload"
        :disabled="!selectedFile || uploading"
        class="btn btn-primary"
        style="width: 100%"
      >
        {{ uploading ? "Uploading..." : "Upload File" }}
      </button>
    </div>

    <div class="form-card">
      <h2 class="form-title">Your Files</h2>

      <div
        v-if="deleteStatus"
        :class="deleteStatus.isError ? 'error-message' : 'success-message'"
      >
        {{ deleteStatus.message }}
      </div>

      <div v-if="isFetching" class="loading-container">
        <div class="loading-content">
          <div class="spinner"></div>
          <span class="loading-text">Loading files...</span>
        </div>
      </div>
      <div v-else-if="files.length === 0" class="empty-state">
        <svg
          class="empty-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-width="1.5"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <h3 class="empty-title">No files yet</h3>
        <p class="empty-description">Upload your first file to get started!</p>
      </div>
      <div v-else style="overflow-x: auto">
        <table class="file-table">
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
              <td class="file-name">{{ file.name }}</td>
              <td class="file-meta">{{ file.mimeType }}</td>
              <td class="file-meta">{{ formatFileSize(file.size || 0) }}</td>
              <td>
                <div class="file-actions">
                  <button
                    type="button"
                    @click="
                      () =>
                        handleViewFile(
                          file.id || 'unknown',
                          file.name || 'unknown',
                          file.mimeType || 'unknown',
                        )
                    "
                    :disabled="viewingFile === file.id"
                    class="action-btn action-btn-edit"
                    title="View File"
                  >
                    {{ viewingFile === file.id ? "⏳" : "👁️" }}
                  </button>
                  <button
                    type="button"
                    @click="() => handleDeleteFile(file.id || 'unknown')"
                    :disabled="deleting === file.id"
                    class="action-btn action-btn-delete"
                    title="Delete File"
                  >
                    {{ deleting === file.id ? "⏳" : "🗑️" }}
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
import type { FileMetadata } from "@nhost/nhost-js/storage";
import { onMounted, ref } from "vue";
import { useAuth } from "../lib/nhost/auth";

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

    files.value = response.body.data?.files || [];
  } catch (err) {
    console.error("Error fetching files:", err);
    error.value = "Failed to load files. Please try refreshing the page.";
  } finally {
    isFetching.value = false;
  }
};

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
    error.value = "Please select a file to upload";
    return;
  }

  uploading.value = true;
  error.value = null;

  try {
    // Upload file to the personal bucket
    // The uploadedByUserId is automatically set by the storage permissions
    const response = await nhost.storage.uploadFiles({
      "bucket-id": "personal",
      "file[]": [selectedFile.value],
    });

    const uploadedFile = response.body.processedFiles?.[0];
    if (uploadedFile === undefined) {
      throw new Error("Failed to upload file");
    }
    uploadResult.value = uploadedFile;

    // Clear the form
    selectedFile.value = null;
    if (fileInputRef.value) {
      fileInputRef.value.value = "";
    }

    // Update the files list
    files.value = [uploadedFile, ...files.value];

    await fetchFiles();

    // Clear success message after 3 seconds
    setTimeout(() => {
      uploadResult.value = null;
    }, 3000);
  } catch (err: unknown) {
    const message = (err as Error).message || "An unknown error occurred";
    error.value = `Failed to upload file: ${message}`;
  } finally {
    uploading.value = false;
  }
};

const handleViewFile = async (
  fileId: string,
  fileName: string,
  mimeType: string,
): Promise<void> => {
  viewingFile.value = fileId;

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
    error.value = `Failed to view file: ${message}`;
    console.error("Error viewing file:", err);
  } finally {
    viewingFile.value = null;
  }
};

const handleDeleteFile = async (fileId: string): Promise<void> => {
  if (!fileId || deleting.value) return;

  deleting.value = fileId;
  error.value = null;
  deleteStatus.value = null;

  const fileToDelete = files.value.find((file) => file.id === fileId);
  const fileName = fileToDelete?.name || "File";

  try {
    // Delete file from storage
    // Permissions ensure users can only delete their own files
    await nhost.storage.deleteFile(fileId);

    deleteStatus.value = {
      message: `${fileName} deleted successfully`,
      isError: false,
    };

    // Remove from local state
    files.value = files.value.filter((file) => file.id !== fileId);

    await fetchFiles();

    // Clear success message after 3 seconds
    setTimeout(() => {
      deleteStatus.value = null;
    }, 3000);
  } catch (err) {
    const message = (err as Error).message || "An unknown error occurred";
    deleteStatus.value = {
      message: `Failed to delete ${fileName}: ${message}`,
      isError: true,
    };
    console.error("Error deleting file:", err);
  } finally {
    deleting.value = null;
  }
};
</script>
