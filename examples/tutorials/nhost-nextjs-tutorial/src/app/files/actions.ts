'use server';

import type { FileMetadata } from '@nhost/nhost-js/storage';
import { revalidatePath } from 'next/cache';
import { createNhostClient } from '../../lib/nhost/server';

export interface ActionResult<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface UploadFileData {
  file: FileMetadata;
  message: string;
}

export interface DeleteFileData {
  message: string;
}

export async function uploadFileAction(
  formData: FormData,
): Promise<ActionResult<UploadFileData>> {
  try {
    const nhost = await createNhostClient();
    const file = formData.get('file') as File;

    if (!file) {
      return { success: false, error: 'Please select a file to upload' };
    }

    const response = await nhost.storage.uploadFiles({
      'bucket-id': 'personal',
      'file[]': [file],
    });

    const uploadedFile = response.body.processedFiles?.[0];
    if (!uploadedFile) {
      return { success: false, error: 'Failed to upload file' };
    }

    revalidatePath('/files');
    return {
      success: true,
      data: {
        file: uploadedFile,
        message: 'File uploaded successfully!',
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return { success: false, error: `Failed to upload file: ${message}` };
  }
}

export async function deleteFileAction(
  fileId: string,
  fileName: string,
): Promise<ActionResult<DeleteFileData>> {
  try {
    const nhost = await createNhostClient();

    if (!fileId) {
      return { success: false, error: 'File ID is required' };
    }

    await nhost.storage.deleteFile(fileId);

    revalidatePath('/files');
    return {
      success: true,
      data: { message: `${fileName} deleted successfully` },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return {
      success: false,
      error: `Failed to delete ${fileName}: ${message}`,
    };
  }
}
