import { InterpreterFrom } from 'xstate'

import { FileItemRef, MultipleFilesUploadMachine } from '../machines'
import { INhostClient } from '../utils/types'

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
  list: FileItemRef[]
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
  bucketId?: string
}

export const uploadMultipleFilesPromise = async (
  nhost: INhostClient,
  service: InterpreterFrom<MultipleFilesUploadMachine>,
  options: UploadMultipleFilesActionParams = { bucketId: 'default' }
): Promise<MultipleFilesHandlerResult> =>
  new Promise((resolve) => {
    const { bucketId } = options
    service.send({
      type: 'UPLOAD',
      url: nhost.storage.url,
      bucketId,
      accessToken: nhost.auth.getAccessToken(),
      adminSecret: nhost.adminSecret
    })
    service.onTransition((s) => {
      if (s.matches('error')) {
        resolve({
          errors: s.context.files.filter((ref) => ref.getSnapshot()?.context.error),
          isError: true,
          list: []
        })
      } else if (s.matches('uploaded')) {
        resolve({ errors: [], isError: false, list: s.context.files })
      }
    })
  })
