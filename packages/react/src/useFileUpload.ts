import { InterpreterFrom } from 'xstate'

import { ActionErrorState } from '@nhost/core'
import { createFileUploadMachine, FileItemRef } from '@nhost/hasura-storage-js'
import { useInterpret, useSelector } from '@xstate/react'

import { useNhostClient } from './useNhostClient'

export interface UploadProgressState {
  /**
   * Returns `true` when the file has been successfully uploaded.
   */
  isUploaded: boolean
  /**
   * Returns `true` when the file is being uploaded.
   */
  isUploading: boolean
  /**
   * Returns the progress of the upload, from 0 to 100. Returns null if the upload has not started yet.
   */
  progress: number | null
}
export interface FileUploadState extends ActionErrorState, UploadProgressState {
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

export interface FileUploadHookResult extends FileUploadState {
  /**
   * Add the file without uploading it.
   */
  add: (file: File) => void

  /**
   * Upload the file given as a parameter, or that has been previously added.
   */
  upload: (file?: File) => void // TODO promisify
  /**
   * Cancel the ongoing upload.
   */
  cancel: () => void
  /**
   * @internal - used by the MultipleFilesUpload component to notice the file should be removed from the list.
   */
  destroy: () => void
}

export type { FileItemRef }

/**
 * Use the hook `useFileUploadItem` to control the file upload of a file in a multiple file upload.
 *
 * It has the same signature as `useFileUpload`.
 *
 * @example
 * ```tsx
 * const Item = ({itemRef}) => {
 *    const { name, progress} = useFileUploadItem(itemRef)
 *    return <li>{name} {progress}</li>
 * }
 *
 * const List = () => {
 *    const { list } = useMultipleFilesUpload()
 *    return <ul>
 *            {list.map((itemRef) => <Item key={item.id} itemRef={item} />)}
 *           </ul>
 * }
 *
 * ```
 */
export const useFileUploadItem = (
  ref: FileItemRef | InterpreterFrom<ReturnType<typeof createFileUploadMachine>>
): FileUploadHookResult => {
  const nhost = useNhostClient()

  const add = (file: File) => {
    ref.send({ type: 'ADD', file })
  }

  const upload = (file?: File) => {
    ref.send({
      type: 'UPLOAD',
      url: nhost.storage.url,
      file,
      accessToken: nhost.auth.getAccessToken(),
      adminSecret: nhost.adminSecret
    })
  }

  const cancel = () => {
    ref.send({ type: 'CANCEL' })
  }

  const destroy = () => {
    ref.send('DESTROY')
  }

  const isUploading = useSelector(ref, (state) => state.matches('uploading'))
  const isUploaded = useSelector(ref, (state) => state.matches('uploaded'))
  const isError = useSelector(ref, (state) => state.matches('error'))
  const error = useSelector(ref, (state) => state.context.error || null)
  const progress = useSelector(ref, (state) => state.context.progress)
  const id = useSelector(ref, (state) => state.context.id)
  const bucketId = useSelector(ref, (state) => state.context.bucketId)
  const name = useSelector(ref, (state) => state.context.file?.name)

  return {
    add,
    upload,
    cancel,
    destroy,
    isUploaded,
    isUploading,
    isError,
    error,
    progress,
    id,
    bucketId,
    name
  }
}

/**
 * Use the hook `useFileUpload` to upload a file.
 *
 * @example
 * ```tsx
 * const {  add,
    upload,
    cancel,
    isUploaded,
    isUploading,
    isError,
    progress,
    id,
    bucketId,
    name } = useFileUpload();
 *
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await upload({ file })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-file-upload
 */
export const useFileUpload = (): FileUploadHookResult => {
  const service = useInterpret(createFileUploadMachine)

  return useFileUploadItem(service)
}
