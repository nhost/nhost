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
import { ToRefs } from 'vue'
import { InterpreterFrom } from 'xstate'
import { useNhostClient } from './useNhostClient'

export interface FileUploadComposableResult extends ToRefs<FileUploadState> {
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
 *
 * @example
 * ```vue
 * <!-- Parent component or page -->
 *
 * <script lang="ts" setup>
 * const { files } = useMultipleFilesUpload()
 * <script lang="ts" setup>
 *
 * <template>
 *  <div v-for="(file, index) of files" :key="index">
 *    <FileUploadItem :file="file" />
 *  </div>
 * </template>
 *
 *
 * <!-- FileUploadItem component -->
 *
 * <script lang="ts" setup>
 * import { FileItemRef } from '@nhost/nhost-js'
 * import { useFileUploadItem } from '@nhost/vue'
 *
 * const { file } = defineProps<{ file: FileItemRef }>()
 *
 * const { name, progress } = useFileUploadItem(file)
 * </script>
 *
 * <template>
 * <div>
 *  <span>{{ name }}</span>
 *    <v-progress-linear v-model="progress">
 *      {{ progress }}
 *    </v-progress-linear>
 *  </div>
 * </template>
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
      bucketId: params.bucketId || bucketId.value
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
 * Use the composable `useFileUpload` to upload a file.
 *
 * @example
 * ```ts
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
