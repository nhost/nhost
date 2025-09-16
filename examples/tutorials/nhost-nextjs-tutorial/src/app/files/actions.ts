"use server";

import { createNhostClient } from "../../lib/nhost/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

export async function uploadFileAction(formData: FormData): Promise<ActionResult> {
  try {
    const nhost = await createNhostClient();
    const file = formData.get("file") as File;

    if (!file) {
      return { success: false, error: "Please select a file to upload" };
    }

    const response = await nhost.storage.uploadFiles({
      "bucket-id": "personal",
      "file[]": [file],
    });

    const uploadedFile = response.body.processedFiles?.[0];
    if (!uploadedFile) {
      return { success: false, error: "Failed to upload file" };
    }

    revalidatePath("/files");
    return {
      success: true,
      data: {
        file: uploadedFile,
        message: "File uploaded successfully!"
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `Failed to upload file: ${message}` };
  }
}

export async function deleteFileAction(fileId: string, fileName: string): Promise<ActionResult> {
  try {
    const nhost = await createNhostClient();

    if (!fileId) {
      return { success: false, error: "File ID is required" };
    }

    await nhost.storage.deleteFile(fileId);

    revalidatePath("/files");
    return {
      success: true,
      data: { message: `${fileName} deleted successfully` }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `Failed to delete ${fileName}: ${message}` };
  }
}

export async function downloadFileAction(fileId: string, fileName: string) {
  try {
    const nhost = await createNhostClient();

    if (!fileId) {
      throw new Error("File ID is required");
    }

    const response = await nhost.storage.getFile(fileId);

    if (!response.body) {
      throw new Error("Failed to download file");
    }

    // Convert the response to a buffer for proper handling
    const arrayBuffer = await response.body.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      success: true,
      data: {
        buffer: buffer,
        fileName: fileName,
        mimeType: response.body.type || 'application/octet-stream'
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: `Failed to download file: ${message}` };
  }
}
