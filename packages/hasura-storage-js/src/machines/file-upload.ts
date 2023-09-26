import { assign, createMachine } from 'xstate'
import { FileUploadConfig, StorageErrorPayload } from '../utils'
import { fetchUpload } from '../utils/upload'

import FallbackFormData from 'form-data'

let FormData: any

if (typeof FormData === 'undefined') {
  FormData = FallbackFormData
}

export type FileUploadContext = {
  progress: number | null
  loaded: number
  error: StorageErrorPayload | null
  id?: string
  bucketId?: string
  file?: File
}

export type FileUploadEventPayload = {}
export type FileUploadEvents =
  | { type: 'ADD'; file: File; id?: string; bucketId?: string; name?: string }
  | ({
      type: 'UPLOAD'
      file?: File
      id?: string
      name?: string
      bucketId?: string
    } & FileUploadConfig)
  | { type: 'UPLOAD_PROGRESS'; progress: number; loaded: number; additions: number }
  | { type: 'UPLOAD_DONE'; id: string; bucketId: string }
  | { type: 'UPLOAD_ERROR'; error: StorageErrorPayload }
  | { type: 'CANCEL' }
  | { type: 'DESTROY' }

export const INITIAL_FILE_CONTEXT: FileUploadContext = {
  progress: null,
  loaded: 0,
  error: null,
  bucketId: undefined,
  file: undefined,
  id: undefined
}

export type FileUploadMachine = ReturnType<typeof createFileUploadMachine>
export const createFileUploadMachine = () =>
  createMachine(
    {
      predictableActionArguments: true,
      schema: {
        context: {} as FileUploadContext,
        events: {} as FileUploadEvents
      },
      tsTypes: {} as import('./file-upload.typegen').Typegen0,
      context: { ...INITIAL_FILE_CONTEXT },
      initial: 'idle',
      on: {
        DESTROY: { actions: 'sendDestroy', target: 'stopped' }
      },
      states: {
        idle: {
          on: {
            ADD: { actions: 'addFile' },
            UPLOAD: { cond: 'hasFile', target: 'uploading' }
          }
        },
        uploading: {
          entry: 'resetProgress',
          on: {
            UPLOAD_PROGRESS: { actions: ['incrementProgress', 'sendProgress'] },
            UPLOAD_DONE: 'uploaded',
            UPLOAD_ERROR: 'error',
            CANCEL: 'idle'
          },
          invoke: { src: 'uploadFile' }
        },
        uploaded: {
          entry: ['setFileMetadata', 'sendDone'],
          on: {
            ADD: { actions: 'addFile', target: 'idle' },
            UPLOAD: { actions: 'resetContext', target: 'uploading' }
          }
        },
        error: {
          entry: ['setError', 'sendError'],
          on: {
            ADD: { actions: 'addFile', target: 'idle' },
            UPLOAD: { actions: 'resetContext', target: 'uploading' }
          }
        },
        stopped: { type: 'final' }
      }
    },
    {
      guards: {
        hasFile: (context, event) => !!context.file || !!event.file
      },

      actions: {
        incrementProgress: assign({
          loaded: (_, { loaded }) => loaded,
          progress: (_, { progress }) => progress
        }),
        setFileMetadata: assign({
          id: (_, { id }) => id,
          bucketId: (_, { bucketId }) => bucketId,
          progress: (_) => 100
        }),
        setError: assign({ error: (_, { error }) => error }),
        sendProgress: () => {},
        sendError: () => {},
        sendDestroy: () => {},
        sendDone: () => {},
        resetProgress: assign({ progress: (_) => null, loaded: (_) => 0 }),
        resetContext: assign((_) => INITIAL_FILE_CONTEXT),
        addFile: assign({
          file: (_, { file }) => file,
          bucketId: (_, { bucketId }) => bucketId,
          id: (_, { id }) => id
        })
      },
      services: {
        uploadFile: (context, event) => (callback) => {
          const file = (event.file || context.file)!
          const data = new FormData()
          data.append('file[]', file)

          let currentLoaded = 0

          fetchUpload(event.url, data, {
            fileId: event.id || context.id,
            bucketId: event.bucketId || context.bucketId,
            accessToken: event.accessToken,
            adminSecret: event.adminSecret,
            name: event.name || file.name,
            onUploadProgress: (event) => {
              const loaded = event.total ? Math.round((event.loaded * file.size!) / event.total) : 0
              const additions = loaded - currentLoaded
              currentLoaded = loaded
              callback({
                type: 'UPLOAD_PROGRESS',
                progress: event.total ? Math.round((loaded * 100) / event.total) : 0,
                loaded,
                additions
              })
            }
          }).then(({ fileMetadata, error }) => {
            if (error) {
              callback({ type: 'UPLOAD_ERROR', error })
            }
            if (fileMetadata && !('processedFiles' in fileMetadata)) {
              const { id, bucketId } = fileMetadata
              callback({ type: 'UPLOAD_DONE', id, bucketId })
            }

            if (fileMetadata && 'processedFiles' in fileMetadata) {
              // TODO: Add support for multiple files
              const { id, bucketId } = fileMetadata.processedFiles[0]
              callback({ type: 'UPLOAD_DONE', id, bucketId })
            }
          })

          return () => {}
        }
      }
    }
  )
