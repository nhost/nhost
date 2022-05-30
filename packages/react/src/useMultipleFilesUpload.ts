import { useMemo } from 'react'

import { createMultipleFilesUploadMachine } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'
import { useNhostBackendUrl } from './useNhostBackendUrl'
type UploadMultipleFilesActionParams = {
  bucket?: string
}

/**
 * Use the hook `useFileUpload` to upload multiple files.
 *
 * @example
 * ```tsx
 * const { upload, add, clear, progress, isUploaded, isUploading, list, hasError, cancel } = useMultipleFilesUpload()
 *
 * const addFile = async (file: File) => {
 *   add(file)
 * }
 *
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   upload()
 * }
 * ```
 */
export const useMultipleFilesUpload = () => {
  const url = useNhostBackendUrl()
  const auth = useAuthInterpreter()
  const machine = useMemo(() => createMultipleFilesUploadMachine({ url, auth }), [url, auth])
  const service = useInterpret(machine, { devTools: true })

  const add = (files: File | File[]) => {
    service.send('ADD', { files })
  }

  const upload = (options: UploadMultipleFilesActionParams = { bucket: 'default' }) => {
    const { bucket } = options
    service.send('UPLOAD', { bucket })
  }

  const cancel = () => {
    service.send('CANCEL')
  }

  const clear = () => {
    service.send('CLEAR')
  }

  const isUploading = useSelector(service, (state) => state.matches('uploading'))
  const isUploaded = useSelector(service, (state) => state.matches('uploaded'))
  const hasError = useSelector(service, (state) => state.matches('error'))

  const progress = useSelector(service, (state) => state.context.progress)
  const list = useSelector(service, (state) => state.context.files)

  return {
    /**
     * Upload the files given as a parameter, or that has been previously added
     */
    upload,
    /**
     * Add one or multiple files to add to the list of files to upload
     */

    add,
    /**
     * Clear the list of files
     */
    clear,
    /**
     * Returns the overall progress of the upload, from 0 to 100. Returns null if the upload has not started yet.
     */
    progress,
    /**
     * Returns `true` when all the files have been successfully uploaded`
     */
    isUploaded,
    /**
     * Returns `true` when the files are being uploaded
     */
    isUploading,
    /**
     * The list of files. The properties can be accessed through `item.getSnapshot()` of with the `useFileUploadItem` hook.
     */
    list,
    /**
     * Returns `true` when at least one file failed to upload.
     */
    hasError,
    /**
     * Cancel the ongoing upload. The files that have been successfully uploaded will not be deleted from the server.
     */
    cancel
  }
}
