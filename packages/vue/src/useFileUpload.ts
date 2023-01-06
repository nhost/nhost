import {
  createFileUploadMachine,
  FileItemRef,
  FileUploadMachine,
  FileUploadState,
  StorageUploadFileParams,
  UploadFileHandlerResult,
  uploadFilePromise
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { InterpreterFrom } from 'xstate'
import { useNhostClient } from './useNhostClient'

export interface FileUploadComposableResult extends FileUploadState {
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
 * Use the composable `useFileUploadItem` to control the file upload of a file in a multiple file upload.
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
): FileUploadComposableResult => {
  const { nhost } = useNhostClient()

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

  const isUploading = useSelector(ref, (state) => state.matches('uploading')).value
  const isUploaded = useSelector(ref, (state) => state.matches('uploaded')).value
  const isError = useSelector(ref, (state) => state.matches('error')).value
  const error = useSelector(ref, (state) => state.context.error || null).value
  const progress = useSelector(ref, (state) => state.context.progress).value
  const id = useSelector(ref, (state) => state.context.id).value
  const bucketId = useSelector(ref, (state) => state.context.bucketId).value
  const name = useSelector(ref, (state) => state.context.file?.name).value

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
 * Use the composable `useFileUpload` to upload a file.
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
 * @docs https://docs.nhost.io/reference/vue/use-file-upload
 */
export const useFileUpload = (): FileUploadComposableResult => {
  const service = useInterpret(createFileUploadMachine)

  return useFileUploadItem(service)
}
