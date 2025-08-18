import { InterpreterFrom } from 'xstate'

import { AnyFileList, FileItemRef, MultipleFilesUploadMachine } from '../machines'
import { FileUploadConfig } from '../utils'

export interface MultipleUploadProgressState {
  /**
   * Returns `true` when the files are being uploaded.
   */
  isUploading: boolean
  /**
   * Returns the overall progress of the upload, from 0 to 100. Returns null if the upload has not started yet.
   */
  progress: number | null
}

export interface MultipleFilesHandlerResult {
  /**
   * The list of file uploads. The properties can be accessed through `item.getSnapshot()` of with the `useFileUploadItem` hook.
   */
  files: FileItemRef[]
  /**
   * Returns `true` when all upload request are processed, but at least one of them has failed.
   */
  isError: boolean
  /**
   * Returns the list of file uploads that have failed
   */
  errors: FileItemRef[]
}

export interface MultipleFilesUploadState
  extends MultipleFilesHandlerResult,
    MultipleUploadProgressState {
  /**
   * Returns `true` when all the files have been successfully uploaded.
   */
  isUploaded: boolean
}

export type UploadMultipleFilesActionParams = {
  files?: AnyFileList
  bucketId?: string
}

export const uploadMultipleFilesPromise = async (
  params: FileUploadConfig & UploadMultipleFilesActionParams,
  service: InterpreterFrom<MultipleFilesUploadMachine>
): Promise<MultipleFilesHandlerResult> =>
  new Promise((resolve) => {
    service.send({
      type: 'UPLOAD',
      ...params,
      files: params.files
    })
    service.onTransition((s) => {
      if (s.matches('error')) {
        resolve({
          errors: s.context.files.filter((ref) => ref.getSnapshot()?.context.error),
          isError: true,
          files: []
        })
      } else if (s.matches('uploaded')) {
        resolve({ errors: [], isError: false, files: s.context.files })
      }
    })
  })
