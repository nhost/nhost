import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAuth } from "./lib/nhost/AuthProvider";
import { formatFileSize } from "./lib/utils";
import ProtectedScreen from "./components/ProtectedScreen";
import type { FileMetadata, ErrorResponse } from "@nhost/nhost-js/storage";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { blobToBase64 } from "./lib/utils";

interface DeleteStatus {
  message: string;
  isError: boolean;
}

interface GraphqlGetFilesResponse {
  files: FileMetadata[];
}

export default function Upload() {
  const { nhost } = useAuth();
  const [selectedFile, setSelectedFile] =
    useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<FileMetadata | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null);

  const fetchFiles = useCallback(async () => {
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

      setFiles(response.body.data?.files || []);
    } catch (err) {
      const errMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(`Failed to fetch files: ${errMessage}`);
    } finally {
      setIsFetching(false);
    }
  }, [nhost.graphql]);

  // Fetch existing files when component mounts
  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // All file types
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setSelectedFile(result);
        setError(null);
        setUploadResult(null);
      }
    } catch (err) {
      setError("Failed to pick document");
      console.error("DocumentPicker Error:", err);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || selectedFile.canceled) {
      setError("Please select a file to upload");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // For React Native, we need to read the file first
      const fileToUpload = selectedFile.assets?.[0];
      if (!fileToUpload) {
        throw new Error("No file selected");
      }

      const file: unknown = {
        uri: fileToUpload.uri,
        name: fileToUpload.name || "file",
        type: fileToUpload.mimeType || "application/octet-stream",
      };
      // Upload file using Nhost storage
      const response = await nhost.storage.uploadFiles({
        "bucket-id": "default",
        "file[]": [file as File],
      });

      // Get the processed file data
      const uploadedFile = response.body.processedFiles?.[0];
      if (uploadedFile == undefined) {
        throw new Error("Failed to upload file");
      }

      setUploadResult(uploadedFile);

      // Reset form
      setSelectedFile(null);

      // Update files list
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
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  // Function to handle viewing a file with proper authorization
  const handleViewFile = async (
    fileId: string,
    fileName: string,
    mimeType: string,
  ) => {
    setViewingFile(fileId);

    try {
      // Fetch the file with authentication using the SDK
      const response = await nhost.storage.getFile(fileId);

      if (!response.body) {
        throw new Error("Failed to retrieve file contents");
      }

      // For iOS/Android, we need to save the file to the device first
      // Create a unique temp file path with a timestamp to prevent collisions
      const fileExtension = fileName.includes(".") ? "" : ".file";
      const tempFileName = fileName.includes(".")
        ? fileName
        : `${fileName}${fileExtension}`;
      const tempFilePath = `${FileSystem.cacheDirectory}${Date.now()}_${tempFileName}`;

      // Get the blob from the response
      const blob = response.body;

      // Convert blob to base64
      const base64Data = await blobToBase64(blob);

      // Write the file to the filesystem
      await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Check if sharing is available (iOS & Android)
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (isSharingAvailable) {
        // Open the file with the default app
        await Sharing.shareAsync(tempFilePath, {
          mimeType: mimeType || "application/octet-stream",
          dialogTitle: `View ${fileName}`,
          UTI: mimeType, // for iOS
        });
      } else {
        throw new Error("Sharing is not available on this device");
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Failed to view file: ${error.message}`);
      console.error("Error viewing file:", err);
      Alert.alert("Error", `Failed to view file: ${error.message}`);
    } finally {
      setViewingFile(null);
    }
  };

  // Function to handle deleting a file
  const handleDeleteFile = (fileId: string) => {
    if (!fileId || deleting) return;

    // Confirm deletion
    Alert.alert("Delete File", "Are you sure you want to delete this file?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeleting(fileId);
            setError(null);
            setDeleteStatus(null);

            // Get the file name for the status message
            const fileToDelete = files.find((file) => file.id === fileId);
            const fileName = fileToDelete?.name || "File";

            try {
              // Delete the file using the Nhost storage SDK
              await nhost.storage.deleteFile(fileId);

              // Show success message
              setDeleteStatus({
                message: `${fileName} deleted successfully`,
                isError: false,
              });

              // Update the local files list by removing the deleted file
              setFiles(files.filter((file) => file.id !== fileId));

              // Refresh the file list
              await fetchFiles();

              // Clear the success message after 3 seconds
              setTimeout(() => {
                setDeleteStatus(null);
              }, 3000);
            } catch (err) {
              // Show error message
              const error = err as FetchError<ErrorResponse>;
              setDeleteStatus({
                message: `Failed to delete ${fileName}: ${error.message}`,
                isError: true,
              });
              console.error("Error deleting file:", err);
            } finally {
              setDeleting(null);
            }
          })();
        },
      },
    ]);
  };

  return (
    <ProtectedScreen>
      <Stack.Screen options={{ title: "File Upload" }} />
      <View style={styles.container}>
        {/* Upload Form */}
        <View style={styles.card}>
          <Text style={styles.title}>Upload a File</Text>

          <TouchableOpacity style={styles.fileUpload} onPress={pickDocument}>
            <View style={styles.uploadIcon}>
              <Text style={styles.uploadIconText}>⬆️</Text>
            </View>
            <Text style={styles.uploadText}>Tap to select a file</Text>
            {selectedFile &&
              !selectedFile.canceled &&
              selectedFile.assets?.[0] && (
                <Text style={styles.fileName}>
                  {selectedFile.assets[0].name}(
                  {formatFileSize(selectedFile.assets[0].size || 0)})
                </Text>
              )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {uploadResult && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                File uploaded successfully!
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              (!selectedFile || selectedFile.canceled || uploading) &&
                styles.buttonDisabled,
            ]}
            onPress={handleUpload}
            disabled={!selectedFile || selectedFile.canceled || uploading}
          >
            <Text style={styles.buttonText}>
              {uploading ? "Uploading..." : "Upload File"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Files List */}
        <View style={styles.card}>
          <Text style={styles.title}>Your Files</Text>

          {deleteStatus && (
            <View
              style={[
                styles.statusContainer,
                deleteStatus.isError
                  ? styles.errorContainer
                  : styles.successContainer,
              ]}
            >
              <Text
                style={
                  deleteStatus.isError ? styles.errorText : styles.successText
                }
              >
                {deleteStatus.message}
              </Text>
            </View>
          )}

          {isFetching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          ) : files.length === 0 ? (
            <Text style={styles.emptyText}>No files uploaded yet.</Text>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id || Math.random().toString()}
              renderItem={({ item }) => (
                <View style={styles.fileItem}>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileNameText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.fileDetails}>
                      {item.mimeType} • {formatFileSize(item.size || 0)}
                    </Text>
                  </View>
                  <View style={styles.fileActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        handleViewFile(
                          item.id || "unknown",
                          item.name || "unknown",
                          item.mimeType || "unknown",
                        )
                      }
                      disabled={viewingFile === item.id}
                    >
                      {viewingFile === item.id ? (
                        <Text style={styles.actionText}>⌛</Text>
                      ) : (
                        <Text style={styles.actionText}>👁️</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteFile(item.id || "unknown")}
                      disabled={deleting === item.id}
                    >
                      {deleting === item.id ? (
                        <Text style={styles.actionText}>⌛</Text>
                      ) : (
                        <Text style={styles.actionText}>🗑️</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              style={styles.fileList}
            />
          )}
        </View>
      </View>
    </ProtectedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  fileUpload: {
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
    marginBottom: 16,
  },
  uploadIcon: {
    marginBottom: 10,
  },
  uploadIconText: {
    fontSize: 24,
  },
  uploadText: {
    fontSize: 16,
    color: "#666",
  },
  fileName: {
    marginTop: 8,
    color: "#0066cc",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#0066cc",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#f44336",
  },
  errorText: {
    color: "#d32f2f",
  },
  successContainer: {
    backgroundColor: "#e8f5e9",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4caf50",
  },
  successText: {
    color: "#2e7d32",
  },
  statusContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    padding: 20,
  },
  fileList: {
    maxHeight: 300,
  },
  fileItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  fileInfo: {
    flex: 1,
    paddingRight: 10,
  },
  fileNameText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 12,
    color: "#777",
  },
  fileActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  deleteButton: {
    backgroundColor: "#fff0f0",
  },
  actionText: {
    fontSize: 16,
  },
});
