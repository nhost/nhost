import { InterpreterFrom } from 'xstate'

import { FileItemRef, FileUploadMachine } from '../machines'
import { FileUploadConfig, StorageActionErrorState, StorageUploadFileParams } from '../utils'

export interface UploadProgressState {
  /**
   * Returns `true` when the file is being uploaded.
   */
  isUploading: boolean
  /**
   * Returns the progress of the upload, from 0 to 100. Returns null if the upload has not started yet.
   */
  progress: number | null
}

export interface UploadFileHandlerResult extends StorageActionErrorState {
  /**
   * Returns `true` when the file has been successfully uploaded.
   */
  isUploaded: boolean
  /**
   * Returns the id of the file.
   */
  id?: string
  /**
   * Returns the bucket id.
   */
  bucketId?: string
  /**
   * Returns the name of the file.
   */
  name?: string
}

export interface FileUploadState extends UploadFileHandlerResult, UploadProgressState {}

export const uploadFilePromise = async (
  params: FileUploadConfig & Partial<StorageUploadFileParams>,
  interpreter: FileItemRef | InterpreterFrom<FileUploadMachine>
): Promise<UploadFileHandlerResult> =>
  new Promise<UploadFileHandlerResult>((resolve) => {
    interpreter.send({
      type: 'UPLOAD',
      ...params
    })
    interpreter.subscribe((s) => {
      if (s.matches('error')) {
        resolve({
          error: s.context.error,
          isError: true,
          isUploaded: false
        })
      } else if (s.matches('uploaded')) {
        resolve({
          error: null,
          isError: false,
          isUploaded: true,
          id: s.context.id,
          bucketId: s.context.id,
          name: s.context.file?.name
        })
      }
    })
  })
