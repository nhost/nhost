import {
  createMultipleFilesUploadMachine,
  FileItemRef,
  MultipleFilesHandlerResult,
  MultipleFilesUploadState,
  UploadMultipleFilesActionParams,
  uploadMultipleFilesPromise
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { Ref, ref } from 'vue'
import { useNhostClient } from './useNhostClient'

export interface MultipleFilesUploadComposableResult extends MultipleFilesUploadState {
  /**
   * Add one or multiple files to add to the list of files to upload.
   */
  add: (
    params: Required<Pick<UploadMultipleFilesActionParams, 'files'>> &
      UploadMultipleFilesActionParams
  ) => void
  /**
   * Upload the files that has been previously added to the list.
   */
  upload: (params?: UploadMultipleFilesActionParams) => Promise<MultipleFilesHandlerResult>
  /**
   * Cancel the ongoing upload. The files that have been successfully uploaded will not be deleted from the server.
   */
  cancel: () => void
  /**
   * Clear the list of files.
   */
  clear: () => void
}

/**
 * Use the composable `useMultipleFilesUpload` to upload multiple files.
 *
 * @example
 * ```ts
 * const { upload, add, clear, progress, isUploaded, isUploading, files, isError, cancel } = useMultipleFilesUpload()
 *
 * const addFile = async (files: File | File[] | FileList) => {
 *   add({ files })
 * }
 *
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   upload()
 * }
 * ```
 * @docs https://docs.nhost.io/reference/vue/use-multiple-files-upload
 */
export const useMultipleFilesUpload = (): MultipleFilesUploadComposableResult => {
  const { nhost } = useNhostClient()
  const errors: Ref<FileItemRef[]> = ref([])

  const service = useInterpret(createMultipleFilesUploadMachine, {}, (state) => {
    if (state.event.type === 'UPLOAD_ERROR') {
      errors.value = state.context.files.filter((ref) => ref.getSnapshot()?.context.error)
    } else if (
      (state.matches('uploaded') || state.event.type === 'CLEAR') &&
      errors.value.length > 0
    ) {
      errors.value = []
    }
  })

  const add = (
    params: Required<Pick<UploadMultipleFilesActionParams, 'files'>> &
      UploadMultipleFilesActionParams
  ) => {
    service.send({ type: 'ADD', ...params })
  }

  const upload = (params?: UploadMultipleFilesActionParams) =>
    uploadMultipleFilesPromise(
      {
        url: nhost.storage.url,
        accessToken: nhost.auth.getAccessToken(),
        adminSecret: nhost.adminSecret,
        ...params
      },
      service
    )

  const cancel = () => {
    service.send('CANCEL')
  }

  const clear = () => {
    service.send('CLEAR')
  }

  const isUploading = useSelector(service, (state) => state.matches('uploading')).value
  const isUploaded = useSelector(service, (state) => state.matches('uploaded')).value
  const isError = useSelector(service, (state) => state.matches('error')).value

  const progress = useSelector(service, (state) => state.context.progress).value
  const files = useSelector(service, (state) => state.context.files).value

  return {
    upload,
    add,
    clear,
    cancel,
    progress,
    isUploaded,
    isUploading,
    files,
    isError,
    errors: errors.value
  }
}
