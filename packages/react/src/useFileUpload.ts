import { useMemo } from 'react'
import { InterpreterFrom } from 'xstate'

import { createFileUploadMachine, FileItemRef } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'
import { useNhostBackendUrl } from './useNhostBackendUrl'

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
) => {
  const add = (file: File) => {
    ref.send({ type: 'ADD', file })
  }

  const upload = (file?: File) => {
    ref.send({ type: 'UPLOAD', file })
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

  const progress = useSelector(ref, (state) => state.context.progress)
  const id = useSelector(ref, (state) => state.context.id)
  const bucketId = useSelector(ref, (state) => state.context.bucketId)
  const name = useSelector(ref, (state) => state.context.file?.name)

  return {
    /**
     * Add the file without uploading it.
     */
    add,
    /**
     * Upload the file given as a parameter, or that has been previously added.
     */
    upload,
    /**
     * Cancel the ongoing upload.
     */
    cancel,
    /**
     * @internal - used by the MultipleFilesUpload component to notice the file should be removed from the list.
     */
    destroy,
    /**
     * Returns `true` when the file has been successfully uploaded.
     */
    isUploaded,
    /**
     * Returns `true` when the file is being uploaded.
     */
    isUploading,
    /**
     * Returns `true` when the file has failed to upload.
     */
    isError,
    /**
     * Returns the progress of the upload, from 0 to 100. Returns null if the upload has not started yet.
     */
    progress,
    /**
     * Returns the id of the file.
     */
    id,
    /**
     * Returns the bucket id.
     */
    bucketId,
    /**
     * Returns the name of the file.
     */
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
export const useFileUpload = () => {
  const url = useNhostBackendUrl()
  const auth = useAuthInterpreter()
  const machine = useMemo(() => createFileUploadMachine({ url, auth }), [url, auth])
  const service = useInterpret(machine)

  return useFileUploadItem(service)
}
