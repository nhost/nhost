import axios, { AxiosRequestHeaders } from 'axios'
import { assign, createMachine } from 'xstate'

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
  | { type: 'UPLOAD_PROGRESS'; progress: number; loaded: number; additions: number }
  | { type: 'UPLOAD_DONE' }
  | { type: 'UPLOAD_ERROR' }
  | { type: 'CANCEL' }
  | { type: 'DESTROY' }

export const INITIAL_FILE_CONTEXT: FileContext = { progress: null, loaded: 0 }

export const createFileMachine = (url: string, authInterpreter: AuthInterpreter) =>
  createMachine(
    {
      preserveActionOrder: true,
      schema: {
        context: {} as FileContext,
        events: {} as FileEvents
      },
      tsTypes: {} as import('./file.typegen').Typegen0,
      context: { ...INITIAL_FILE_CONTEXT },
      initial: 'idle',
      on: {
        ADD: { actions: 'addFile' },
        DESTROY: { actions: 'sendDestroy', target: 'stopped' }
      },
      states: {
        idle: {
          on: { UPLOAD: { cond: 'hasFile', target: 'uploading' } }
        },
        uploading: {
          entry: 'resetProgress',
          on: {
            UPLOAD_PROGRESS: { actions: ['setUploadProgress', 'sendProgress'] },
            UPLOAD_DONE: 'uploaded',
            UPLOAD_ERROR: 'error',
            CANCEL: 'idle'
          },
          invoke: { src: 'uploadFile' }
        },
        uploaded: { entry: 'sendDone' },
        error: { entry: 'sendError' },
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
        sendError: () => {},
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
          // TODO also add hasura admin secret
          const jwt = authInterpreter.state.context.accessToken.value
          if (jwt) {
            headers['Authorization'] = `Bearer ${jwt}`
          }
          let currentLoaded = 0
          const controller = new AbortController()
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
              signal: controller.signal,
              onUploadProgress: (event: ProgressEvent) => {
                const loaded = Math.round((event.loaded * context.file?.size!) / event.total)
                const additions = loaded - currentLoaded
                currentLoaded = loaded
                callback({
                  type: 'UPLOAD_PROGRESS',
                  progress: Math.round((loaded * 100) / event.total),
                  loaded,
                  additions
                })
              }
            })
            .then((res) => {
              //   TODO get some info back from hasura-storage
              callback('UPLOAD_DONE')
            })
            .catch((err) => {
              //   TODO get some info back from hasura-storage
              callback('UPLOAD_ERROR')
            })

          onReceive(({ type }) => {
            if (type === 'CANCEL') {
              controller.abort()
            }
          })
        }
      }
    }
  )
