import {
  createFileUploadMachine,
  FileItemRef,
  FileUploadMachine,
  FileUploadState,
  StorageUploadFileParams,
  UploadFileHandlerResult,
  uploadFilePromise
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/react'
import { InterpreterFrom } from 'xstate'
import { useNhostClient } from './useNhostClient'

export interface FileUploadHookResult extends FileUploadState {
  /**
   * Add the file without uploading it.
   */
  add: (params: StorageUploadFileParams) => void

  /**
   * Upload the file given as a parameter, or that has been previously added.
   */
  upload: (params: Partial<StorageUploadFileParams>) => Promise<UploadFileHandlerResult>

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
  ref: FileItemRef | InterpreterFrom<FileUploadMachine>
): FileUploadHookResult => {
  const nhost = useNhostClient()

  const add = (params: StorageUploadFileParams) => {
    ref.send({
      type: 'ADD',
      file: params.file,
      bucketId: params.bucketId || bucketId
    })
  }

  const upload = (params: Partial<StorageUploadFileParams>) =>
    uploadFilePromise(
      {
        url: nhost.storage.url,
        accessToken: nhost.auth.getAccessToken(),
        adminSecret: nhost.adminSecret,
        ...params
      },
      ref
    )

  const cancel = () => {
    ref.send('CANCEL')
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
 *  upload,
 *  cancel,
 *  isUploaded,
 *  isUploading,
 *  isError,
 *  progress,
 *  id,
 *  bucketId,
 *  name
 * } = useFileUpload();
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
