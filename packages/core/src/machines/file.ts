import { assign, createMachine } from 'xstate'
import axios, { AxiosRequestHeaders } from 'axios'
import { AuthInterpreter } from '../types'

type FileContext = {
  progress: number | null
  loaded: number
  id?: string
  name?: string
  bucket?: string
  file?: File
}

type FileEvents =
  | { type: 'ADD'; file: File; id?: string; bucket?: string; name?: string }
  | { type: 'UPLOAD'; file?: File; id?: string; bucket?: string; name?: string }
  | { type: 'UPLOAD_PROGRESS'; progress: number; loaded: number }
  | { type: 'UPLOAD_DONE' }
  | { type: 'UPLOAD_ERROR' }
  | { type: 'CANCEL' }
  | { type: 'DESTROY' }

export const createFileMachine = (url: string, authInterpreter: AuthInterpreter) =>
  createMachine(
    {
      preserveActionOrder: true,
      schema: {
        context: {} as FileContext,
        events: {} as FileEvents
      },
      tsTypes: {} as import('./file.typegen').Typegen0,
      context: {
        progress: null,
        loaded: 0
      },
      initial: 'idle',
      on: {
        ADD: {
          actions: 'addFile'
        },
        DESTROY: {
          actions: 'sendDestroy',
          target: 'stopped'
        }
      },
      states: {
        idle: {
          on: {
            UPLOAD: {
              cond: 'hasFile',
              target: 'uploading'
            }
          }
        },
        uploading: {
          entry: 'resetProgress',
          on: {
            UPLOAD_PROGRESS: { actions: ['setUploadProgress', 'sendProgress'] },
            UPLOAD_DONE: 'uploaded',
            UPLOAD_ERROR: 'error'
          },
          invoke: {
            src: 'uploadFile'
          }
        },
        uploaded: {
          entry: ['sendDone']
        },
        error: {},
        stopped: { type: 'final' }
      }
    },
    {
      guards: {
        hasFile: (context, event) => !!context.file || !!event.file
      },

      actions: {
        setUploadProgress: assign({
          loaded: (_, event) => event.loaded,
          progress: (_, event) => event.progress
        }),
        sendProgress: () => {},
        sendDestroy: () => {},
        sendDone: () => {},
        resetProgress: assign({ progress: (_) => null, loaded: (_) => 0 }),
        addFile: assign({
          file: (_, { file }) => file,
          bucket: (_, { bucket }) => bucket,
          name: (_, { name }) => name,
          id: (_, { id }) => id
        })
      },
      services: {
        uploadFile: (context, event) => (callback, onReceive) => {
          const headers: AxiosRequestHeaders = {
            'Content-Type': 'multipart/form-data'
          }
          const fileId = event.id || context.id
          if (fileId) {
            headers['x-nhost-file-id'] = fileId
          }
          const bucket = event.bucket || context.bucket
          if (bucket) {
            headers['x-nhost-bucket-id'] = bucket
          }
          const name = event.name || context.name
          if (name) {
            headers['x-nhost-file-name'] = name
          }
          const data = new FormData()
          data.append('file', (event.file || context.file)!)
          // TODO hasura admin secret
          const jwt = authInterpreter.state.context.accessToken.value
          if (jwt) {
            headers['Authorization'] = `Bearer ${jwt}`
          }
          axios
            .post<{
              bucketId: string
              createdAt: string
              etag: string
              id: string
              isUploaded: true
              mimeType: string
              name: string
              size: number
              updatedAt: string
              uploadedByUserId: string
            }>(url + '/v1/storage/files', data, {
              headers,
              onUploadProgress: ({ loaded, total }: ProgressEvent) => {
                callback({
                  type: 'UPLOAD_PROGRESS',
                  progress: Math.round((loaded * 100) / total),
                  loaded: Math.round((loaded * context.file?.size!) / total)
                })
              }
            })
            .then((res) => {
              //   TODO get some info back from hasura-storage
              callback({ type: 'UPLOAD_DONE' })
            })
            .catch((err) => {
              //   TODO get some info back from hasura-storage
              callback({ type: 'UPLOAD_ERROR' })
            })

          onReceive((e) => {
            if (e.type === 'CANCEL') {
              console.log('cancel upload') // TODO
            }
          })

          return () => {
            // TODO
            //   console.log('file upload done')
            // clearInterval(id)
          }
        }
      }
    }
  )
